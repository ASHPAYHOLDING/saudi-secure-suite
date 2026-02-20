/**
 * paypal-webhook — Hardened PayPal webhook (Tap/Stripe standard)
 *
 * PayPal verification: POST to /v1/notifications/verify-webhook-signature
 * STRICT: if verification fails or returns non-SUCCESS → 401, no processing.
 *
 * Flow: rawBody → eventId → resolve tenant → load creds → STRICT verify → idempotency → process
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";

const PROVIDER = "paypal";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paypal-transmission-sig, paypal-transmission-id, paypal-cert-url, paypal-auth-algo, paypal-transmission-time",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function captureHeaders(req: Request): Record<string, string> {
  const safe: Record<string, string> = {};
  const skip = new Set(["authorization", "cookie", "x-api-key"]);
  req.headers.forEach((v, k) => { if (!skip.has(k.toLowerCase())) safe[k] = v; });
  return safe;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function writeAudit(db: any, tenantId: string | null, action: string, eventId: string | null, details: unknown) {
  try {
    await db.from("audit_logs").insert({
      tenant_id: tenantId ?? "00000000-0000-0000-0000-000000000000",
      user_id: "00000000-0000-0000-0000-000000000000",
      action, entity_type: "payment_webhook", entity_label: PROVIDER,
      entity_id: eventId, changes: details,
    });
  } catch (e) { console.error("[audit]", e); }
}

async function updateWebhookEvent(db: any, providerEventId: string, patch: Record<string, unknown>) {
  await db.from("webhook_events")
    .update({ ...patch, processed_at: new Date().toISOString() })
    .eq("provider", PROVIDER).eq("provider_event_id", providerEventId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const tenantIdParam = url.searchParams.get("tenant_id") ?? null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const masterKey = Deno.env.get("INTEGRATION_SECRET_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  // 1. Read raw body ONCE
  const rawBody = await req.text();
  const rawHeaders = captureHeaders(req);
  let body: any = {};
  try { body = JSON.parse(rawBody); } catch { /* keep empty */ }

  // 2. Extract provider_event_id
  const providerEventId = body?.id ?? body?.resource?.id ?? "";
  if (!providerEventId) {
    await writeAudit(db, tenantIdParam, "webhook_rejected", null, { reason: "missing_event_id" });
    return json({ error: "Missing event id" }, 400);
  }

  const payloadHash = await sha256hex(rawBody);

  // 3. Resolve tenant_id
  let tenantId: string | null = body?.resource?.custom_id?.split(":")?.[1]
    ?? body?.resource?.purchase_units?.[0]?.custom_id?.split(":")?.[1]
    ?? tenantIdParam
    ?? null;

  if (!tenantId) {
    const { data: pi } = await db.from("payment_intents")
      .select("tenant_id").eq("provider_session_id", providerEventId).maybeSingle();
    tenantId = pi?.tenant_id ?? null;
  }

  if (!tenantId) {
    await writeAudit(db, null, "webhook_rejected", providerEventId, { reason: "cannot_resolve_tenant_id" });
    return json({ error: "Cannot determine tenant_id" }, 400);
  }

  // 4. Load credentials
  const { data: record } = await db.from("tenant_payment_providers")
    .select("credentials_encrypted, environment")
    .eq("tenant_id", tenantId).eq("provider", PROVIDER).maybeSingle();

  if (!record?.credentials_encrypted) {
    await writeAudit(db, tenantId, "webhook_rejected", providerEventId, { reason: "provider_not_configured" });
    return json({ error: "Provider not configured" }, 401);
  }

  let clientId = "", clientSecret = "", webhookId = "";
  try {
    const creds = JSON.parse(await decryptSecret(record.credentials_encrypted, masterKey));
    clientId = creds.client_id ?? "";
    clientSecret = creds.client_secret ?? "";
    webhookId = creds.webhook_id ?? "";
  } catch { return json({ error: "Decryption failed" }, 500); }

  // 5. STRICT PayPal signature verification
  const transmissionId = req.headers.get("paypal-transmission-id") ?? "";
  const transmissionTime = req.headers.get("paypal-transmission-time") ?? "";
  const certUrl = req.headers.get("paypal-cert-url") ?? "";
  const authAlgo = req.headers.get("paypal-auth-algo") ?? "";
  const transmissionSig = req.headers.get("paypal-transmission-sig") ?? "";

  if (!transmissionId || !transmissionSig) {
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "missing_paypal_signature_headers" });
    return json({ error: "Missing PayPal signature headers" }, 401);
  }

  if (!webhookId) {
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "webhook_id_not_configured" });
    return json({ error: "Webhook ID not configured" }, 401);
  }

  // Get OAuth token
  const isLive = record.environment === "live";
  const paypalBase = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

  const tokenRes = await fetch(`${paypalBase}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  }).catch(() => null);

  if (!tokenRes?.ok) {
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "paypal_oauth_failed" });
    return json({ error: "PayPal OAuth failed" }, 401);
  }

  const tokenData = await tokenRes.json().catch(() => ({}));
  const accessToken = tokenData?.access_token ?? "";
  if (!accessToken) {
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "paypal_no_access_token" });
    return json({ error: "PayPal OAuth failed" }, 401);
  }

  const verifyRes = await fetch(`${paypalBase}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: authAlgo, cert_url: certUrl, transmission_id: transmissionId,
      transmission_sig: transmissionSig, transmission_time: transmissionTime,
      webhook_id: webhookId, webhook_event: body,
    }),
  }).catch(() => null);

  const verifyData = verifyRes ? await verifyRes.json().catch(() => ({})) : {};

  if (verifyData?.verification_status !== "SUCCESS") {
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, {
      reason: "paypal_verification_failed", status: verifyData?.verification_status,
    });
    return json({ error: "PayPal signature verification failed" }, 401);
  }

  // 6. Idempotency insert — ONLY after verification
  const { error: idErr } = await db.from("webhook_events").insert({
    provider: PROVIDER, provider_event_id: providerEventId, event_id: providerEventId,
    tenant_id: tenantId, payload_hash: payloadHash, raw_headers: rawHeaders,
    status: "received", signature_valid: true, received_at: new Date().toISOString(),
  });
  if (idErr?.code === "23505") return json({ ok: true, status: "duplicate" }, 200);

  await updateWebhookEvent(db, providerEventId, { status: "processing", signature_valid: true });

  // 7-9. Process payment
  const isPaid = body?.event_type === "PAYMENT.CAPTURE.COMPLETED" || body?.event_type === "CHECKOUT.ORDER.APPROVED";
  const amount = body?.resource?.amount?.value ? parseFloat(body.resource.amount.value) : null;
  const currency = body?.resource?.amount?.currency_code ?? null;
  const invoiceId = body?.resource?.custom_id ?? body?.resource?.purchase_units?.[0]?.custom_id ?? null;

  let paymentIntentId: string | null = null;
  let dbInvoiceId: string | null = invoiceId;

  const { data: pi } = await db.from("payment_intents")
    .select("id, invoice_id, amount, currency, tenant_id, status")
    .eq("provider_session_id", providerEventId).maybeSingle();

  if (pi) {
    paymentIntentId = pi.id;
    dbInvoiceId = pi.invoice_id ?? invoiceId;
    if (pi.tenant_id !== tenantId) {
      await updateWebhookEvent(db, providerEventId, { status: "rejected", processing_error: "tenant_mismatch" });
      await writeAudit(db, tenantId, "webhook_tenant_mismatch", providerEventId, { expected: tenantId, actual: pi.tenant_id });
      return json({ error: "Tenant ownership mismatch" }, 403);
    }
  }

  let processingError: string | null = null;
  try {
    if (isPaid && dbInvoiceId) {
      const { data: invoice } = await db.from("invoices")
        .select("id, tenant_id, amount_due, grand_total, currency, status")
        .eq("id", dbInvoiceId).maybeSingle();

      if (!invoice) throw new Error(`Invoice not found: ${dbInvoiceId}`);
      if (invoice.tenant_id !== tenantId) throw new Error("Invoice tenant mismatch");

      const expectedAmount = invoice.amount_due ?? invoice.grand_total;
      if (amount !== null && expectedAmount !== null) {
        const tolerance = Math.max(expectedAmount * 0.01, 0.01);
        if (Math.abs(amount - expectedAmount) > tolerance)
          throw new Error(`Amount mismatch: expected ${expectedAmount}, received ${amount}`);
      }

      if (currency && invoice.currency && currency.toUpperCase() !== invoice.currency.toUpperCase())
        throw new Error(`Currency mismatch: expected ${invoice.currency}, received ${currency}`);

      if (invoice.status !== "paid") {
        await db.from("invoice_payments").insert({
          invoice_id: dbInvoiceId, tenant_id: tenantId,
          amount: amount ?? expectedAmount,
          payment_method: "gateway_paypal",
          payment_date: new Date().toISOString().split("T")[0],
          reference_number: providerEventId,
          notes: `دفع تلقائي عبر PayPal — event: ${providerEventId}`,
          currency: currency ?? invoice.currency,
          created_by: "00000000-0000-0000-0000-000000000000",
        });
      }
    }

    if (paymentIntentId) {
      await db.from("payment_intents")
        .update({ status: isPaid ? "paid" : "failed", updated_at: new Date().toISOString() })
        .eq("id", paymentIntentId);
    }

    await updateWebhookEvent(db, providerEventId, { status: "processed", signature_valid: true });
    await writeAudit(db, tenantId, "webhook_processed", providerEventId, {
      invoice_id: dbInvoiceId, amount, currency, is_paid: isPaid, event_type: body?.event_type,
    });
  } catch (err: any) {
    processingError = err.message;
    console.error("[paypal-webhook] processing error:", err);
    await updateWebhookEvent(db, providerEventId, { status: "failed", signature_valid: true, processing_error: processingError });
    await writeAudit(db, tenantId, "webhook_processing_failed", providerEventId, { error: processingError, invoice_id: dbInvoiceId });
    return json({ ok: false, status: "failed", error: processingError }, 200);
  }

  return json({ ok: true, status: isPaid ? "processed" : "received" }, 200);
});
