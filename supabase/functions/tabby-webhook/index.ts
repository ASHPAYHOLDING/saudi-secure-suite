import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tabby-signature" };

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmacSha256hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

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

  const providerEventId = body?.id ?? body?.payment?.id ?? body?.order?.reference_id ?? "";
  if (!providerEventId) return json({ error: "Missing event id" }, 400);

  const payloadHash = await sha256hex(rawBody);

  const { error: idErr } = await db.from("webhook_events").insert({
    provider: "tabby", provider_event_id: providerEventId, event_id: providerEventId,
    tenant_id: tenantId, payload_hash: payloadHash, raw_headers: {}, status: "received",
    received_at: new Date().toISOString(),
  });
  if (idErr?.code === "23505") return json({ ok: true, status: "duplicate" }, 200);

  const { data: record } = await db.from("tenant_payment_providers")
    .select("webhook_secret_encrypted").eq("tenant_id", tenantId).eq("provider", "tabby").maybeSingle();
  if (!record?.webhook_secret_encrypted) return json({ error: "Webhook secret not configured" }, 401);

  let webhookSecret: string;
  try { webhookSecret = await decryptSecret(record.webhook_secret_encrypted, masterKey); }
  catch { return json({ error: "Decryption failed" }, 500); }

  const sig = req.headers.get("x-tabby-signature");
  if (!sig) return json({ error: "Missing x-tabby-signature" }, 401);
  const expected = await hmacSha256hex(webhookSecret, rawBody);
  if (!timingSafeEqual(sig.toLowerCase(), expected.toLowerCase())) return json({ error: "Signature mismatch" }, 401);

  await db.from("webhook_events").update({ signature_valid: true, status: "processing" })
    .eq("provider", "tabby").eq("provider_event_id", providerEventId);

  const isPaid = body?.status === "CLOSED" || body?.payment?.status === "closed";
  const invoiceId = body?.payment?.order?.reference_id ?? body?.order?.reference_id ?? null;
  const amount = body?.payment?.amount ? parseFloat(body.payment.amount) : null;
  const currency = body?.payment?.currency ?? "SAR";

  if (isPaid && invoiceId) {
    const { data: invoice } = await db.from("invoices").select("id, status, grand_total, currency")
      .eq("id", invoiceId).eq("tenant_id", tenantId).maybeSingle();
    if (invoice && invoice.status !== "paid") {
      await db.from("invoice_payments").insert({ invoice_id: invoiceId, tenant_id: tenantId,
        payment_date: new Date().toISOString().split("T")[0], amount: amount ?? invoice.grand_total,
        payment_method: "gateway_tabby", reference_number: providerEventId,
        notes: "دفع تلقائي عبر Tabby (BNPL)", currency: currency ?? invoice.currency, created_by: "00000000-0000-0000-0000-000000000000" });
      await db.from("invoices").update({ status: "paid" }).eq("id", invoiceId);
    }
  }

  await db.from("webhook_events").update({ status: "processed" })
    .eq("provider", "tabby").eq("provider_event_id", providerEventId);
  await db.from("audit_logs").insert({ tenant_id: tenantId, user_id: "00000000-0000-0000-0000-000000000000",
    action: "webhook_processed", entity_type: "payment_webhook", entity_label: "tabby",
    entity_id: providerEventId, changes: { isPaid, invoiceId, amount, currency } });

  return json({ ok: true });
});
