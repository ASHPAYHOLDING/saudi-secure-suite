import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paypal-transmission-sig, paypal-transmission-id, paypal-cert-url, paypal-auth-algo, paypal-transmission-time" };

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

  const providerEventId = body?.id ?? body?.resource?.id ?? "";
  if (!providerEventId) return json({ error: "Missing event id" }, 400);

  const payloadHash = await sha256hex(rawBody);

  const { error: idErr } = await db.from("webhook_events").insert({
    provider: "paypal", provider_event_id: providerEventId, event_id: providerEventId,
    tenant_id: tenantId, payload_hash: payloadHash, raw_headers: {}, status: "received",
    received_at: new Date().toISOString(),
  });
  if (idErr?.code === "23505") return json({ ok: true, status: "duplicate" }, 200);

  // Load credentials for PayPal verification
  const { data: record } = await db.from("tenant_payment_providers")
    .select("credentials_encrypted, webhook_secret_encrypted").eq("tenant_id", tenantId).eq("provider", "paypal").maybeSingle();
  if (!record) return json({ error: "Provider not configured" }, 401);

  let clientId = "", clientSecret = "", webhookId = "";
  try {
    const creds = JSON.parse(await decryptSecret(record.credentials_encrypted, masterKey));
    clientId = creds.client_id ?? "";
    clientSecret = creds.client_secret ?? "";
    webhookId = creds.webhook_id ?? "";
  } catch { return json({ error: "Decryption failed" }, 500); }

  // PayPal uses their verify-webhook-signature API
  const transmissionId  = req.headers.get("paypal-transmission-id") ?? "";
  const transmissionTime = req.headers.get("paypal-transmission-time") ?? "";
  const certUrl         = req.headers.get("paypal-cert-url") ?? "";
  const authAlgo        = req.headers.get("paypal-auth-algo") ?? "";
  const transmissionSig = req.headers.get("paypal-transmission-sig") ?? "";

  // Get OAuth token
  const tokenRes = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  }).catch(() => null);

  if (tokenRes?.ok) {
    const tokenData = await tokenRes.json().catch(() => ({}));
    const accessToken = tokenData?.access_token ?? "";
    if (accessToken && webhookId && transmissionId) {
      const verifyRes = await fetch("https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ auth_algo: authAlgo, cert_url: certUrl, transmission_id: transmissionId,
          transmission_sig: transmissionSig, transmission_time: transmissionTime,
          webhook_id: webhookId, webhook_event: body }),
      }).catch(() => null);
      const verifyData = verifyRes ? await verifyRes.json().catch(() => ({})) : {};
      if (verifyData?.verification_status && verifyData.verification_status !== "SUCCESS") {
        await db.from("webhook_events").update({ status: "rejected", signature_valid: false })
          .eq("provider", "paypal").eq("provider_event_id", providerEventId);
        return json({ error: "Signature verification failed" }, 401);
      }
    }
  }

  await db.from("webhook_events").update({ signature_valid: true, status: "processing" })
    .eq("provider", "paypal").eq("provider_event_id", providerEventId);

  const isPaid = body?.event_type === "PAYMENT.CAPTURE.COMPLETED" || body?.event_type === "CHECKOUT.ORDER.APPROVED";
  const amount = body?.resource?.amount?.value ? parseFloat(body.resource.amount.value) : null;
  const currency = body?.resource?.amount?.currency_code ?? null;
  const invoiceId = body?.resource?.custom_id ?? body?.resource?.purchase_units?.[0]?.custom_id ?? null;

  if (isPaid && invoiceId) {
    const { data: invoice } = await db.from("invoices").select("id, status, grand_total, currency")
      .eq("id", invoiceId).eq("tenant_id", tenantId).maybeSingle();
    if (invoice && invoice.status !== "paid") {
      await db.from("invoice_payments").insert({ invoice_id: invoiceId, tenant_id: tenantId,
        payment_date: new Date().toISOString().split("T")[0], amount: amount ?? invoice.grand_total,
        payment_method: "gateway_paypal", reference_number: providerEventId,
        notes: "دفع تلقائي عبر PayPal", currency: currency ?? invoice.currency, created_by: "00000000-0000-0000-0000-000000000000" });
      await db.from("invoices").update({ status: "paid" }).eq("id", invoiceId);
    }
  }

  await db.from("webhook_events").update({ status: "processed" })
    .eq("provider", "paypal").eq("provider_event_id", providerEventId);
  await db.from("audit_logs").insert({ tenant_id: tenantId, user_id: "00000000-0000-0000-0000-000000000000",
    action: "webhook_processed", entity_type: "payment_webhook", entity_label: "paypal",
    entity_id: providerEventId, changes: { isPaid, invoiceId, amount, currency } });

  return json({ ok: true });
});
