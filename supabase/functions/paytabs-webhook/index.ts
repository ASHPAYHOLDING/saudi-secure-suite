/**
 * paytabs-webhook — Hardened PayTabs webhook (Tap/Stripe standard)
 *
 * Signature: x-paytabs-signature = HMAC-SHA256(rawBody, serverKey)
 * STRICT: verify BEFORE any DB write. No event locking.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";

const PROVIDER = "paytabs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paytabs-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  const providerEventId = body?.tran_ref ?? body?.cart_id ?? "";
  if (!providerEventId) {
    await writeAudit(db, tenantIdParam, "webhook_rejected", null, { reason: "missing_event_id" });
    return json({ error: "Missing tran_ref in payload" }, 400);
  }

  const payloadHash = await sha256hex(rawBody);

  // 3. Resolve tenant_id
  let tenantId: string | null = body?.metadata?.tenant_id
    ?? body?.customer_details?.tenant_id
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

  // 4. STRICT: Check signature header FIRST
  const sig = req.headers.get("x-paytabs-signature") ?? req.headers.get("signature");
  if (!sig) {
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "missing_signature_header" });
    return json({ error: "Missing signature" }, 401);
  }

  // 5. Load + decrypt webhook secret
  const { data: record } = await db.from("tenant_payment_providers")
    .select("webhook_secret_encrypted").eq("tenant_id", tenantId).eq("provider", PROVIDER).maybeSingle();

  if (!record?.webhook_secret_encrypted) {
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "webhook_secret_not_configured" });
    return json({ error: "Missing signature" }, 401);
  }

  let webhookSecret: string;
  try { webhookSecret = await decryptSecret(record.webhook_secret_encrypted, masterKey); }
  catch { return json({ error: "Decryption failed" }, 500); }

  // Verify HMAC
  const expected = await hmacSha256hex(webhookSecret, rawBody);
  if (!timingSafeEqual(sig.toLowerCase(), expected.toLowerCase())) {
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "hmac_mismatch" });
    return json({ error: "Signature mismatch" }, 401);
  }

  // 6. Idempotency insert — ONLY after signature verified
  const { error: idErr } = await db.from("webhook_events").insert({
    provider: PROVIDER, provider_event_id: providerEventId, event_id: providerEventId,
    tenant_id: tenantId, payload_hash: payloadHash, raw_headers: rawHeaders,
    status: "received", signature_valid: true, received_at: new Date().toISOString(),
  });
  if (idErr?.code === "23505") return json({ ok: true, status: "duplicate" }, 200);

  await updateWebhookEvent(db, providerEventId, { status: "processing", signature_valid: true });

  // 7-9. Process
  const isPaid = body?.payment_result?.response_status === "A";
  const invoiceId = body?.cart_id ?? null;
  const amount = body?.tran_total ? parseFloat(body.tran_total) : null;
  const currency = body?.tran_currency ?? null;

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
          payment_method: "gateway_paytabs",
          payment_date: new Date().toISOString().split("T")[0],
          reference_number: providerEventId,
          notes: `دفع تلقائي عبر PayTabs — event: ${providerEventId}`,
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
      invoice_id: dbInvoiceId, amount, currency, is_paid: isPaid,
    });
  } catch (err: any) {
    processingError = err.message;
    console.error("[paytabs-webhook] processing error:", err);
    await updateWebhookEvent(db, providerEventId, { status: "failed", signature_valid: true, processing_error: processingError });
    await writeAudit(db, tenantId, "webhook_processing_failed", providerEventId, { error: processingError, invoice_id: dbInvoiceId });
    return json({ ok: false, status: "failed", error: processingError }, 200);
  }

  return json({ ok: true, status: isPaid ? "processed" : "received" }, 200);
});
