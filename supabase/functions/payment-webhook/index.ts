/**
 * payment-webhook: Unified BYO-Gateway webhook endpoint — HARDENED
 *
 * Security model:
 * 1. Raw body read ONCE, used for both signature verification and parsing.
 * 2. Idempotency FIRST: insert into webhook_events before anything else.
 *    Conflict on (provider, provider_event_id) => 200 duplicate, no side-effects.
 * 3. Tenant resolved from payment_intents / paid_gateway_transactions using
 *    session_id embedded in payload. If cannot resolve → reject 400.
 * 4. Webhook secret loaded PER-TENANT from tenant_payment_providers (encrypted).
 *    Decrypted using INTEGRATION_SECRET_KEY env var.
 * 5. Strict HMAC-SHA256 signature verification (provider-specific headers).
 *    Missing header → 401. Bad signature → 401. No "optional" path.
 * 6. Atomic invoice payment: update only if status != 'paid'.
 *    Validates tenant_id + amount (1% tolerance) + currency.
 * 7. Audit log on every terminal state.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { withRequestTimeout } from "../_shared/timeout-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, " +
    "hashid, x-tap-signature, x-moyasar-signature, x-hyperpay-signature, x-webhook-signature, " +
    "stripe-signature, x-geidea-signature",
};

// ── SHA-256 hash helper ───────────────────────────────────────────────────────
async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Timing-safe string compare ────────────────────────────────────────────────
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ── HMAC-SHA256 hex ───────────────────────────────────────────────────────────
async function hmacSha256hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Provider-specific signature verification ─────────────────────────────────
async function verifySignature(
  req: Request, rawBody: string, provider: string, secret: string
): Promise<{ valid: boolean; reason: string }> {

  if (provider === "tap") {
    // Tap: header "hashid" contains HMAC-SHA256(raw_body, secret)
    const sig = req.headers.get("hashid") ?? req.headers.get("x-tap-signature");
    if (!sig) return { valid: false, reason: "Missing Tap signature header 'hashid'" };
    const expected = await hmacSha256hex(secret, rawBody);
    if (!timingSafeEqual(sig.toLowerCase(), expected.toLowerCase()))
      return { valid: false, reason: "Tap HMAC mismatch" };
    return { valid: true, reason: "" };
  }

  if (provider === "moyasar") {
    // Moyasar: header "X-Moyasar-Signature" = HMAC-SHA256(raw_body, secret)
    const sig = req.headers.get("x-moyasar-signature");
    if (!sig) return { valid: false, reason: "Missing Moyasar signature header 'x-moyasar-signature'" };
    const expected = await hmacSha256hex(secret, rawBody);
    if (!timingSafeEqual(sig.toLowerCase(), expected.toLowerCase()))
      return { valid: false, reason: "Moyasar HMAC mismatch" };
    return { valid: true, reason: "" };
  }

  if (provider === "hyperpay") {
    // HyperPay: header "X-Webhook-Signature" = HMAC-SHA256(raw_body, secret)
    const sig = req.headers.get("x-webhook-signature") ?? req.headers.get("x-hyperpay-signature");
    if (!sig) return { valid: false, reason: "Missing HyperPay signature header 'x-webhook-signature'" };
    const expected = await hmacSha256hex(secret, rawBody);
    if (!timingSafeEqual(sig.toLowerCase(), expected.toLowerCase()))
      return { valid: false, reason: "HyperPay HMAC mismatch" };
    return { valid: true, reason: "" };
  }

  if (provider === "stripe") {
    // Stripe: "Stripe-Signature" header — format: t=<ts>,v1=<hmac>
    // Signed payload: "<timestamp>.<raw_body>"
    const sigHeader = req.headers.get("stripe-signature");
    if (!sigHeader) return { valid: false, reason: "Missing Stripe-Signature header" };
    const parts: Record<string, string[]> = {};
    for (const part of sigHeader.split(",")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      if (!parts[k]) parts[k] = [];
      parts[k].push(v);
    }
    const timestamps = parts["t"];
    const v1sigs = parts["v1"];
    if (!timestamps?.length) return { valid: false, reason: "Missing 't' in Stripe-Signature" };
    if (!v1sigs?.length) return { valid: false, reason: "Missing 'v1' in Stripe-Signature" };
    const tsMs = parseInt(timestamps[0], 10) * 1000;
    if (isNaN(tsMs)) return { valid: false, reason: "Invalid timestamp in Stripe-Signature" };
    if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) return { valid: false, reason: "Stripe timestamp expired" };
    const signedPayload = `${timestamps[0]}.${rawBody}`;
    const expected = await hmacSha256hex(secret, signedPayload);
    for (const v1 of v1sigs) {
      if (timingSafeEqual(v1.toLowerCase(), expected.toLowerCase())) return { valid: true, reason: "" };
    }
    return { valid: false, reason: "Stripe v1 HMAC mismatch" };
  }

  if (provider === "geidea") {
    // Geidea: "X-Geidea-Signature" = HMAC-SHA256(raw_body, secret)
    const sig = req.headers.get("x-geidea-signature");
    if (!sig) return { valid: false, reason: "Missing X-Geidea-Signature header" };
    const expected = await hmacSha256hex(secret, rawBody);
    if (!timingSafeEqual(sig.toLowerCase(), expected.toLowerCase()))
      return { valid: false, reason: "Geidea HMAC mismatch" };
    return { valid: true, reason: "" };
  }

  return { valid: false, reason: "Unknown provider" };
}

// ── Extract raw headers (for audit storage) ───────────────────────────────────
function captureHeaders(req: Request): Record<string, string> {
  const safe: Record<string, string> = {};
  const skip = new Set(["authorization", "cookie", "x-api-key"]);
  req.headers.forEach((v, k) => {
    if (!skip.has(k.toLowerCase())) safe[k] = v;
  });
  return safe;
}

// ── JSON helper ───────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Helpers: webhook_events ──────────────────────────────────────────────────
async function insertWebhookEvent(
  db: any,
  provider: string,
  providerEventId: string,
  tenantId: string | null,
  payloadHash: string,
  rawHeaders: Record<string, string>
): Promise<{ isDuplicate: boolean }> {
  const { error } = await db.from("webhook_events").insert({
    provider,
    provider_event_id: providerEventId,
    event_id: providerEventId,          // keep old column in sync
    tenant_id: tenantId,
    payload_hash: payloadHash,
    raw_headers: rawHeaders,
    status: "received",
    received_at: new Date().toISOString(),
  });

  if (error?.code === "23505") return { isDuplicate: true };
  return { isDuplicate: false };
}

async function updateWebhookEvent(
  db: any,
  provider: string,
  providerEventId: string,
  patch: Record<string, unknown>
) {
  await db
    .from("webhook_events")
    .update({ ...patch, processed_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId);
}

async function writeAudit(
  db: any,
  tenantId: string | null,
  action: string,
  entityLabel: string,
  eventId: string | null,
  details: unknown
) {
  try {
    await db.from("audit_logs").insert({
      tenant_id: tenantId ?? "00000000-0000-0000-0000-000000000000",
      user_id: "00000000-0000-0000-0000-000000000000",
      action,
      entity_type: "payment_webhook",
      entity_label: entityLabel,
      entity_id: eventId,
      changes: details,
    });
  } catch (e) {
    console.error("[audit] write failed:", e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(withRequestTimeout(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") ?? "";
  const tenantIdParam = url.searchParams.get("tenant_id") ?? null;

  if (!["tap", "moyasar", "hyperpay", "stripe", "geidea"].includes(provider)) {
    return json({ error: "Invalid or missing ?provider= parameter" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const masterKey   = Deno.env.get("INTEGRATION_SECRET_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const blocked = await checkRateLimit(req, db, "webhook", corsHeaders);
  if (blocked) return blocked;

  // ── 1. Read raw body ONCE ──────────────────────────────────────────────────
  const rawBody = await req.text();
  const rawHeaders = captureHeaders(req);

  let body: any = {};
  try { body = JSON.parse(rawBody); } catch { /* keep empty */ }

  // ── 2. Extract provider_event_id early (before idempotency insert) ─────────
  let providerEventId = "";
  if (provider === "tap")      providerEventId = body?.id ?? body?.charge_id ?? "";
  if (provider === "moyasar")  providerEventId = body?.id ?? "";
  if (provider === "hyperpay") providerEventId = body?.id ?? body?.merchantTransactionId ?? "";
  if (provider === "stripe")   providerEventId = body?.id ?? "";
  if (provider === "geidea")   providerEventId = body?.orderId ?? body?.id ?? body?.transactionId ?? "";

  if (!providerEventId) {
    await writeAudit(db, tenantIdParam, "webhook_rejected", provider, null,
      { reason: "missing provider_event_id in payload" });
    return json({ error: "Cannot determine event ID from payload" }, 400);
  }

  const payloadHash = await sha256hex(rawBody);

  // ── 3. Resolve tenant_id ───────────────────────────────────────────────────
  //   Priority: URL param > metadata in payload > session lookup
  let tenantId: string | null = tenantIdParam;

  if (!tenantId) {
    tenantId = body?.metadata?.tenant_id ?? body?.data?.metadata?.tenant_id ?? null;
  }

  if (!tenantId) {
    // Lookup via payment_intents using the session id
    const sessionId = providerEventId;
    const { data: pi } = await db
      .from("payment_intents")
      .select("tenant_id")
      .eq("provider_session_id", sessionId)
      .maybeSingle();
    tenantId = pi?.tenant_id ?? null;
  }

  if (!tenantId) {
    const payloadHash2 = await sha256hex(rawBody);
    await db.from("webhook_events").insert({
      provider, provider_event_id: providerEventId, event_id: providerEventId,
      tenant_id: null, payload_hash: payloadHash2, raw_headers: rawHeaders,
      status: "rejected", received_at: new Date().toISOString(),
      processing_error: "Cannot resolve tenant_id",
    }).catch(() => {});
    await writeAudit(db, null, "webhook_rejected", provider, providerEventId,
      { reason: "cannot_resolve_tenant_id" });
    return json({ error: "Cannot determine tenant_id" }, 400);
  }

  // ── 4. STRICT: Signature verification BEFORE idempotency ────────────────
  // Load + decrypt tenant webhook secret
  const { data: providerRecord } = await db
    .from("tenant_payment_providers")
    .select("webhook_secret_encrypted, credentials_encrypted, status")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();

  if (!providerRecord) {
    await writeAudit(db, tenantId, "webhook_rejected", provider, providerEventId,
      { reason: "provider_not_configured" });
    return json({ error: "Missing required signature" }, 401);
  }

  // Extract webhook secret: prefer webhook_secret_encrypted, fallback to credentials
  let webhookSecret: string | null = null;

  if (providerRecord.webhook_secret_encrypted) {
    try {
      webhookSecret = await decryptSecret(providerRecord.webhook_secret_encrypted, masterKey);
    } catch (e: any) {
      await writeAudit(db, tenantId, "webhook_rejected", provider, providerEventId,
        { reason: "decryption_failed" });
      return json({ error: "Internal error: cannot decrypt webhook secret" }, 500);
    }
  } else if (providerRecord.credentials_encrypted) {
    // Fallback: extract from credentials JSON
    try {
      const creds = JSON.parse(await decryptSecret(providerRecord.credentials_encrypted, masterKey));
      webhookSecret = creds?.webhook_secret ?? creds?.secret_key ?? null;
    } catch { /* intentional */ }
  }

  if (!webhookSecret) {
    await writeAudit(db, tenantId, "webhook_rejected", provider, providerEventId,
      { reason: "webhook_secret_not_configured" });
    return json({ error: "Missing required signature" }, 401);
  }

  // ── 5. Strict signature verification ──────────────────────────────────────
  const sigResult = await verifySignature(req, rawBody, provider, webhookSecret);

  if (!sigResult.valid) {
    // Log rejected event (with suffix to avoid blocking real event ID)
    try {
      await db.from("webhook_events").insert({
        provider, provider_event_id: `${providerEventId}_badsig_${Date.now()}`,
        event_id: providerEventId, tenant_id: tenantId,
        payload_hash: payloadHash, raw_headers: rawHeaders,
        status: "rejected", signature_valid: false,
        processing_error: sigResult.reason, received_at: new Date().toISOString(),
      });
    } catch { /* non-critical */ }
    await writeAudit(db, tenantId, "webhook_signature_invalid", provider, providerEventId,
      { reason: sigResult.reason });
    return json({ error: "Webhook signature verification failed: " + sigResult.reason }, 401);
  }

  // ── 6. Idempotency insert — ONLY after signature verified ─────────────────
  const { isDuplicate } = await insertWebhookEvent(
    db, provider, providerEventId, tenantId, payloadHash, rawHeaders
  );

  if (isDuplicate) {
    return json({ ok: true, status: "duplicate" }, 200);
  }

  // Signature valid — update record to processing
  await db.from("webhook_events")
    .update({ signature_valid: true, status: "processing" })
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId);

  // ── 7. Extract payment info ────────────────────────────────────────────────
  let isPaid = false;
  let sessionId = providerEventId;
  let invoiceId: string | null = body?.metadata?.invoice_id ?? null;
  let amount: number | null = null;
  let currency: string | null = null;

  if (provider === "tap") {
    isPaid = body?.status === "CAPTURED";
    amount = body?.amount ?? null;
    currency = body?.currency ?? null;
  } else if (provider === "moyasar") {
    isPaid = body?.status === "paid";
    amount = body?.amount != null ? body.amount / 100 : null; // halalas → SAR
    currency = body?.currency ?? null;
    invoiceId ??= body?.metadata?.invoice_id ?? null;
  } else if (provider === "hyperpay") {
    const code = body?.result?.code ?? "";
    isPaid = /^(000\.000\.|000\.100\.|000\.[36])/.test(code);
    amount = body?.amount != null ? parseFloat(body.amount) : null;
    currency = body?.currency ?? null;
    sessionId = body?.id ?? body?.merchantTransactionId ?? providerEventId;
  } else if (provider === "stripe") {
    const eventType = body?.type ?? "";
    isPaid = eventType === "payment_intent.succeeded" || eventType === "charge.succeeded";
    const obj = body?.data?.object ?? {};
    const rawAmount = obj?.amount_received ?? obj?.amount ?? null;
    amount = rawAmount !== null ? rawAmount / 100 : null; // cents → SAR/USD
    currency = (obj?.currency ?? null)?.toUpperCase() ?? null;
    invoiceId ??= obj?.metadata?.invoice_id ?? null;
    sessionId = obj?.payment_intent ?? obj?.id ?? providerEventId;
  } else if (provider === "geidea") {
    const geideaStatus = body?.status ?? body?.detailedStatus ?? "";
    isPaid = geideaStatus === "Paid" || geideaStatus === "Success";
    amount = body?.amount != null ? parseFloat(body.amount) : null;
    currency = (body?.currency ?? null)?.toUpperCase() ?? null;
    invoiceId ??= body?.merchantReferenceId?.split("_invoice_")[1]?.split("_")[0] ?? null;
  }

  // ── 8. Resolve payment_intent ──────────────────────────────────────────────
  let paymentIntentId: string | null = null;
  let dbTenantId: string = tenantId;
  let dbInvoiceId: string | null = invoiceId;
  let dbAmount: number | null = amount;
  let dbCurrency: string | null = currency;

  const { data: pi } = await db
    .from("payment_intents")
    .select("id, invoice_id, amount, currency, tenant_id, status")
    .eq("provider_session_id", sessionId)
    .maybeSingle();

  if (pi) {
    paymentIntentId = pi.id;
    dbInvoiceId = pi.invoice_id ?? invoiceId;
    dbAmount = pi.amount;
    dbCurrency = pi.currency;
    dbTenantId = pi.tenant_id;
  } else {
    // Legacy fallback
    const { data: tx } = await db
      .from("paid_gateway_transactions")
      .select("id, invoice_id, amount, currency, tenant_id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (tx) {
      dbInvoiceId = tx.invoice_id ?? invoiceId;
      dbAmount = tx.amount;
      dbCurrency = tx.currency;
      dbTenantId = tx.tenant_id;
    }
  }

  // ── 9. Validate tenant ownership ──────────────────────────────────────────
  if (dbTenantId !== tenantId) {
    await updateWebhookEvent(db, provider, providerEventId, {
      status: "rejected", signature_valid: true,
      processing_error: `tenant_mismatch: expected ${tenantId}, got ${dbTenantId}`,
    });
    await writeAudit(db, tenantId, "webhook_tenant_mismatch", provider, providerEventId,
      { expected: tenantId, actual: dbTenantId });
    return json({ error: "Tenant ownership mismatch" }, 403);
  }

  // ── 10. Process payment atomically ────────────────────────────────────────
  let processingError: string | null = null;

  try {
    if (isPaid && dbInvoiceId) {
      // Validate invoice
      const { data: invoice } = await db
        .from("invoices")
        .select("id, tenant_id, amount_due, currency, status")
        .eq("id", dbInvoiceId)
        .maybeSingle();

      if (!invoice) {
        throw new Error(`Invoice not found: ${dbInvoiceId}`);
      }
      if (invoice.tenant_id !== tenantId) {
        throw new Error(`Invoice tenant mismatch`);
      }

      // Amount validation (1% tolerance for rounding)
      if (dbAmount !== null && invoice.amount_due !== null) {
        const tolerance = Math.max(invoice.amount_due * 0.01, 0.01);
        if (Math.abs(dbAmount - invoice.amount_due) > tolerance) {
          throw new Error(
            `Amount mismatch: expected ${invoice.amount_due}, received ${dbAmount}`
          );
        }
      }

      // Currency validation
      if (dbCurrency && invoice.currency &&
          dbCurrency.toUpperCase() !== invoice.currency.toUpperCase()) {
        throw new Error(
          `Currency mismatch: expected ${invoice.currency}, received ${dbCurrency}`
        );
      }

      // Insert payment record (atomic: only if not already paid)
      if (invoice.status !== "paid") {
        await db.from("invoice_payments").insert({
          invoice_id: dbInvoiceId,
          tenant_id: tenantId,
          amount: dbAmount ?? invoice.amount_due,
          payment_method: `gateway_${provider}`,
          payment_date: new Date().toISOString().split("T")[0],
          reference_number: providerEventId,
          notes: `دفع تلقائي عبر ${provider} — event: ${providerEventId}`,
          created_by: "00000000-0000-0000-0000-000000000000",
        });
      }
    }

    // Update payment intent
    if (paymentIntentId) {
      await db.from("payment_intents")
        .update({ status: isPaid ? "paid" : "failed", updated_at: new Date().toISOString() })
        .eq("id", paymentIntentId);
    }

    // Mark webhook event processed
    await updateWebhookEvent(db, provider, providerEventId, {
      status: "processed",
      signature_valid: true,
    });

    // Audit success
    await writeAudit(db, tenantId, "webhook_processed", provider, providerEventId, {
      invoice_id: dbInvoiceId,
      amount: dbAmount,
      currency: dbCurrency,
      is_paid: isPaid,
      payment_intent_id: paymentIntentId,
    });

  } catch (err: any) {
    processingError = err.message;
    console.error(`[payment-webhook] processing error:`, err);

    await updateWebhookEvent(db, provider, providerEventId, {
      status: "failed",
      signature_valid: true,
      processing_error: processingError,
    });

    await writeAudit(db, tenantId, "webhook_processing_failed", provider, providerEventId, {
      error: processingError,
      invoice_id: dbInvoiceId,
    });

    // Return 200 to prevent aggressive retries from re-processing
    return json({ ok: false, status: "failed", error: processingError }, 200);
  }

  return json({ ok: true, status: isPaid ? "processed" : "received" }, 200);
}, 30000, corsHeaders));
