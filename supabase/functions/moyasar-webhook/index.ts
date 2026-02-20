/**
 * moyasar-webhook — Dedicated Moyasar payment webhook endpoint
 *
 * URL tenants give to Moyasar dashboard:
 *   POST https://<project>.supabase.co/functions/v1/moyasar-webhook?tenant_id=<uuid>
 *
 * Moyasar signature header: "X-Moyasar-Signature"
 * Amount is in halalas (divide by 100 to get SAR).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";

const PROVIDER = "moyasar";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-moyasar-signature",
};

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmacSha256hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function captureHeaders(req: Request): Record<string, string> {
  const safe: Record<string, string> = {};
  const skip = new Set(["authorization", "cookie", "x-api-key"]);
  req.headers.forEach((v, k) => { if (!skip.has(k.toLowerCase())) safe[k] = v; });
  return safe;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function insertWebhookEvent(db: any, providerEventId: string, tenantId: string | null, payloadHash: string, rawHeaders: Record<string, string>): Promise<{ isDuplicate: boolean }> {
  const { error } = await db.from("webhook_events").insert({
    provider: PROVIDER, provider_event_id: providerEventId, event_id: providerEventId,
    tenant_id: tenantId, payload_hash: payloadHash, raw_headers: rawHeaders,
    status: "received", received_at: new Date().toISOString(),
  });
  if (error?.code === "23505") return { isDuplicate: true };
  return { isDuplicate: false };
}

async function updateWebhookEvent(db: any, providerEventId: string, patch: Record<string, unknown>) {
  await db.from("webhook_events")
    .update({ ...patch, processed_at: new Date().toISOString() })
    .eq("provider", PROVIDER)
    .eq("provider_event_id", providerEventId);
}

async function writeAudit(db: any, tenantId: string | null, action: string, eventId: string | null, details: unknown) {
  try {
    await db.from("audit_logs").insert({
      tenant_id: tenantId ?? "00000000-0000-0000-0000-000000000000",
      user_id: "00000000-0000-0000-0000-000000000000",
      action, entity_type: "payment_webhook", entity_label: PROVIDER, entity_id: eventId, changes: details,
    });
  } catch (e) { console.error("[audit]", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const tenantIdParam = url.searchParams.get("tenant_id") ?? null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const masterKey   = Deno.env.get("INTEGRATION_SECRET_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const rawBody = await req.text();
  const rawHeaders = captureHeaders(req);

  let body: any = {};
  try { body = JSON.parse(rawBody); } catch { /* keep empty */ }

  // Moyasar wraps events: body.data or body directly
  const eventData = body?.data ?? body;
  const providerEventId: string = body?.id ?? eventData?.id ?? "";
  if (!providerEventId) {
    await writeAudit(db, tenantIdParam, "webhook_rejected", null, { reason: "missing_event_id" });
    return json({ error: "Cannot determine event ID from Moyasar payload" }, 400);
  }

  const payloadHash = await sha256hex(rawBody);

  let tenantId: string | null = tenantIdParam
    ?? eventData?.metadata?.tenant_id
    ?? body?.metadata?.tenant_id
    ?? null;

  if (!tenantId) {
    const { data: pi } = await db
      .from("payment_intents")
      .select("tenant_id")
      .eq("provider_session_id", providerEventId)
      .maybeSingle();
    tenantId = pi?.tenant_id ?? null;
  }

  if (!tenantId) {
    await db.from("webhook_events").insert({
      provider: PROVIDER, provider_event_id: providerEventId, event_id: providerEventId,
      tenant_id: null, payload_hash: payloadHash, raw_headers: rawHeaders,
      status: "rejected", received_at: new Date().toISOString(),
      processing_error: "Cannot resolve tenant_id",
    }).catch(() => {});
    await writeAudit(db, null, "webhook_rejected", providerEventId, { reason: "cannot_resolve_tenant_id" });
    return json({ error: "Cannot determine tenant_id" }, 400);
  }

  const { isDuplicate } = await insertWebhookEvent(db, providerEventId, tenantId, payloadHash, rawHeaders);
  if (isDuplicate) return json({ ok: true, status: "duplicate" }, 200);

  const { data: providerRecord } = await db
    .from("tenant_payment_providers")
    .select("webhook_secret_encrypted, credentials_encrypted, status")
    .eq("tenant_id", tenantId)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (!providerRecord) {
    await updateWebhookEvent(db, providerEventId, { status: "rejected", signature_valid: false, processing_error: "Provider not configured for tenant" });
    await writeAudit(db, tenantId, "webhook_rejected", providerEventId, { reason: "provider_not_configured" });
    return json({ error: "Moyasar not configured for this tenant" }, 400);
  }

  let webhookSecret: string | null = null;
  if (providerRecord.webhook_secret_encrypted) {
    try { webhookSecret = await decryptSecret(providerRecord.webhook_secret_encrypted, masterKey); }
    catch (e: any) {
      await updateWebhookEvent(db, providerEventId, { status: "rejected", signature_valid: false, processing_error: "Decryption failed: " + e.message });
      return json({ error: "Internal error: cannot decrypt webhook secret" }, 500);
    }
  } else if (providerRecord.credentials_encrypted) {
    try {
      const creds = JSON.parse(await decryptSecret(providerRecord.credentials_encrypted, masterKey));
      webhookSecret = creds?.webhook_secret ?? creds?.secret_key ?? null;
    } catch { /* intentional */ }
  }

  if (!webhookSecret) {
    await updateWebhookEvent(db, providerEventId, { status: "rejected", signature_valid: false, processing_error: "Webhook secret not configured" });
    await writeAudit(db, tenantId, "webhook_rejected", providerEventId, { reason: "webhook_secret_not_configured" });
    return json({ error: "Moyasar webhook secret not configured" }, 401);
  }

  // STRICT Moyasar signature: "X-Moyasar-Signature"
  const sig = req.headers.get("x-moyasar-signature");
  if (!sig) {
    await updateWebhookEvent(db, providerEventId, { status: "rejected", signature_valid: false, processing_error: "Missing x-moyasar-signature header" });
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "missing_signature_header" });
    return json({ error: "Missing required Moyasar signature header 'x-moyasar-signature'" }, 401);
  }

  const expected = await hmacSha256hex(webhookSecret, rawBody);
  if (!timingSafeEqual(sig.toLowerCase(), expected.toLowerCase())) {
    await updateWebhookEvent(db, providerEventId, { status: "rejected", signature_valid: false, processing_error: "Moyasar HMAC mismatch" });
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "hmac_mismatch" });
    return json({ error: "Moyasar webhook signature verification failed" }, 401);
  }

  await db.from("webhook_events")
    .update({ signature_valid: true, status: "processing" })
    .eq("provider", PROVIDER)
    .eq("provider_event_id", providerEventId);

  // Moyasar-specific: amount in halalas, status = "paid"
  const isPaid = eventData?.status === "paid";
  const amount: number | null = eventData?.amount != null ? eventData.amount / 100 : null;
  const currency: string | null = eventData?.currency ?? null;
  const invoiceId: string | null = eventData?.metadata?.invoice_id ?? body?.metadata?.invoice_id ?? null;

  let paymentIntentId: string | null = null;
  let dbInvoiceId: string | null = invoiceId;
  let dbAmount: number | null = amount;
  let dbCurrency: string | null = currency;

  const { data: pi } = await db
    .from("payment_intents")
    .select("id, invoice_id, amount, currency, tenant_id, status")
    .eq("provider_session_id", providerEventId)
    .maybeSingle();

  if (pi) {
    paymentIntentId = pi.id;
    dbInvoiceId = pi.invoice_id ?? invoiceId;
    dbAmount = pi.amount;
    dbCurrency = pi.currency;
    if (pi.tenant_id !== tenantId) {
      await updateWebhookEvent(db, providerEventId, { status: "rejected", signature_valid: true, processing_error: "tenant_mismatch" });
      await writeAudit(db, tenantId, "webhook_tenant_mismatch", providerEventId, { expected: tenantId, actual: pi.tenant_id });
      return json({ error: "Tenant ownership mismatch" }, 403);
    }
  }

  let processingError: string | null = null;
  try {
    if (isPaid && dbInvoiceId) {
      const { data: invoice } = await db
        .from("invoices")
        .select("id, tenant_id, amount_due, currency, status")
        .eq("id", dbInvoiceId)
        .maybeSingle();

      if (!invoice) throw new Error(`Invoice not found: ${dbInvoiceId}`);
      if (invoice.tenant_id !== tenantId) throw new Error("Invoice tenant mismatch");

      if (dbAmount !== null && invoice.amount_due !== null) {
        const tolerance = Math.max(invoice.amount_due * 0.01, 0.01);
        if (Math.abs(dbAmount - invoice.amount_due) > tolerance)
          throw new Error(`Amount mismatch: expected ${invoice.amount_due}, received ${dbAmount}`);
      }

      if (dbCurrency && invoice.currency && dbCurrency.toUpperCase() !== invoice.currency.toUpperCase())
        throw new Error(`Currency mismatch: expected ${invoice.currency}, received ${dbCurrency}`);

      if (invoice.status !== "paid") {
        await db.from("invoice_payments").insert({
          invoice_id: dbInvoiceId, tenant_id: tenantId,
          amount: dbAmount ?? invoice.amount_due,
          payment_method: "gateway_moyasar",
          payment_date: new Date().toISOString().split("T")[0],
          reference_number: providerEventId,
          notes: `دفع تلقائي عبر Moyasar — event: ${providerEventId}`,
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
      invoice_id: dbInvoiceId, amount: dbAmount, currency: dbCurrency, is_paid: isPaid,
    });

  } catch (err: any) {
    processingError = err.message;
    console.error("[moyasar-webhook] processing error:", err);
    await updateWebhookEvent(db, providerEventId, { status: "failed", signature_valid: true, processing_error: processingError });
    await writeAudit(db, tenantId, "webhook_processing_failed", providerEventId, { error: processingError, invoice_id: dbInvoiceId });
    return json({ ok: false, status: "failed", error: processingError }, 200);
  }

  return json({ ok: true, status: isPaid ? "processed" : "received" }, 200);
});
