import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant_id");
  if (!tenantId) return json({ error: "Missing tenant_id" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const masterKey = Deno.env.get("INTEGRATION_SECRET_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const rawBody = await req.text();
  let body: any = {};
  try { body = JSON.parse(rawBody); } catch { /* ok */ }

  // MyFatoorah sends InvoiceId / PaymentId
  const providerEventId = String(body?.InvoiceId ?? body?.PaymentId ?? body?.id ?? "");
  if (!providerEventId) return json({ error: "Missing InvoiceId in payload" }, 400);

  const payloadHash = await sha256hex(rawBody);

  const { error: idErr } = await db.from("webhook_events").insert({
    provider: "myfatoorah", provider_event_id: providerEventId, event_id: providerEventId,
    tenant_id: tenantId, payload_hash: payloadHash, raw_headers: {}, status: "received",
    received_at: new Date().toISOString(),
  });
  if (idErr?.code === "23505") return json({ ok: true, status: "duplicate" }, 200);

  // MyFatoorah verification: call their API to verify payment (no signature header)
  const { data: record } = await db.from("tenant_payment_providers")
    .select("credentials_encrypted").eq("tenant_id", tenantId).eq("provider", "myfatoorah").maybeSingle();

  let apiToken = "";
  if (record?.credentials_encrypted) {
    try {
      const creds = JSON.parse(await decryptSecret(record.credentials_encrypted, masterKey));
      apiToken = creds?.api_token ?? "";
    } catch { /* ok */ }
  }

  if (!apiToken) return json({ error: "Provider not configured" }, 401);

  // Verify with MyFatoorah API
  const verifyRes = await fetch("https://api.myfatoorah.com/v2/GetPaymentStatus", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ Key: providerEventId, KeyType: "InvoiceId" }),
  }).catch(() => null);

  const verifyData = verifyRes ? await verifyRes.json().catch(() => ({})) : {};
  const isPaid = verifyData?.Data?.InvoiceStatus === "Paid";
  const amount = verifyData?.Data?.InvoiceValue ?? null;
  const currency = "KWD"; // MyFatoorah default

  const invoiceId = body?.CustomerReference ?? verifyData?.Data?.CustomerReference ?? null;

  await db.from("webhook_events").update({ signature_valid: true, status: "processing" })
    .eq("provider", "myfatoorah").eq("provider_event_id", providerEventId);

  if (isPaid && invoiceId) {
    const { data: invoice } = await db.from("invoices").select("id, status, grand_total, currency, tenant_id")
      .eq("id", invoiceId).eq("tenant_id", tenantId).maybeSingle();
    if (invoice && invoice.status !== "paid") {
      await db.from("invoice_payments").insert({ invoice_id: invoiceId, tenant_id: tenantId,
        payment_date: new Date().toISOString().split("T")[0], amount: amount ?? invoice.grand_total,
        payment_method: "gateway_myfatoorah", reference_number: providerEventId,
        notes: "دفع تلقائي عبر MyFatoorah", currency: invoice.currency, created_by: "00000000-0000-0000-0000-000000000000" });
      await db.from("invoices").update({ status: "paid" }).eq("id", invoiceId);
    }
  }

  await db.from("webhook_events").update({ status: "processed" })
    .eq("provider", "myfatoorah").eq("provider_event_id", providerEventId);
  await db.from("audit_logs").insert({ tenant_id: tenantId, user_id: "00000000-0000-0000-0000-000000000000",
    action: "webhook_processed", entity_type: "payment_webhook", entity_label: "myfatoorah",
    entity_id: providerEventId, changes: { isPaid, invoiceId, amount } });

  return json({ ok: true });
});
