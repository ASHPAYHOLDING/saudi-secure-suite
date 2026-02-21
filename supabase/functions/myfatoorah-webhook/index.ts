/**
 * myfatoorah-webhook — Hardened MyFatoorah webhook (Tap/Stripe standard)
 *
 * MyFatoorah does NOT send a signature header. Verification is done by calling
 * their GetPaymentStatus API with the tenant's API token. The API response is
 * the "signature" — if it returns Paid + matching amounts, we trust it.
 *
 * Flow:
 * 1) Read raw body
 * 2) Extract provider_event_id
 * 3) Resolve tenant_id (metadata → payment_intents)
 * 4) Load tenant credentials
 * 5) Verify via MyFatoorah API (strict — must succeed)
 * 6) Idempotency insert (only after verification)
 * 7) Tenant ownership check
 * 8) Amount + currency validation
 * 9) Create invoice_payments
 * 10) Update payment_intents
 * 11) Update webhook_events
 * 12) Audit log
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { withRequestTimeout } from "../_shared/timeout-guard.ts";

const PROVIDER = "myfatoorah";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(withRequestTimeout(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const tenantIdParam = url.searchParams.get("tenant_id") ?? null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const masterKey = Deno.env.get("INTEGRATION_SECRET_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const blocked = await checkRateLimit(req, db, "webhook", corsHeaders);
  if (blocked) return blocked;

  // 1. Read raw body ONCE
  const rawBody = await req.text();
  const rawHeaders = captureHeaders(req);
  let body: any = {};
  try { body = JSON.parse(rawBody); } catch { /* keep empty */ }

  // 2. Extract provider_event_id
  const providerEventId = String(body?.InvoiceId ?? body?.PaymentId ?? body?.id ?? "");
  if (!providerEventId) {
    await writeAudit(db, tenantIdParam, "webhook_rejected", null, { reason: "missing_event_id" });
    return json({ error: "Missing InvoiceId in payload" }, 400);
  }

  const payloadHash = await sha256hex(rawBody);

  // 3. Resolve tenant_id (metadata → payment_intents → URL param)
  let tenantId: string | null = body?.metadata?.tenant_id
    ?? body?.CustomerReference?.split(":")?.[1] // convention: "invoice_id:tenant_id"
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

  // 4. Load tenant credentials
  const { data: record } = await db.from("tenant_payment_providers")
    .select("credentials_encrypted, environment")
    .eq("tenant_id", tenantId).eq("provider", PROVIDER).maybeSingle();

  if (!record?.credentials_encrypted) {
    await writeAudit(db, tenantId, "webhook_rejected", providerEventId, { reason: "provider_not_configured" });
    return json({ error: "Provider not configured" }, 401);
  }

  let apiToken = "";
  try {
    const creds = JSON.parse(await decryptSecret(record.credentials_encrypted, masterKey));
    apiToken = creds?.api_token ?? creds?.api_key ?? "";
  } catch {
    return json({ error: "Decryption failed" }, 500);
  }

  if (!apiToken) {
    await writeAudit(db, tenantId, "webhook_rejected", providerEventId, { reason: "missing_api_token" });
    return json({ error: "Provider not configured" }, 401);
  }

  // 5. STRICT verification via MyFatoorah API (this IS the signature for MyFatoorah)
  const isLive = record.environment === "live";
  const baseUrl = isLive ? "https://api.myfatoorah.com" : "https://apitest.myfatoorah.com";

  const verifyRes = await fetch(`${baseUrl}/v2/GetPaymentStatus`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ Key: providerEventId, KeyType: "InvoiceId" }),
  }).catch(() => null);

  if (!verifyRes || !verifyRes.ok) {
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "api_verification_failed", status: verifyRes?.status });
    return json({ error: "MyFatoorah API verification failed" }, 401);
  }

  const verifyData = await verifyRes.json().catch(() => ({}));
  if (!verifyData?.IsSuccess || !verifyData?.Data) {
    await writeAudit(db, tenantId, "webhook_signature_invalid", providerEventId, { reason: "api_returned_failure", data: verifyData });
    return json({ error: "MyFatoorah API verification failed" }, 401);
  }

  const paymentData = verifyData.Data;
  const isPaid = paymentData.InvoiceStatus === "Paid";
  const verifiedAmount: number | null = paymentData.InvoiceValue ?? null;
  // Use currency FROM the verified API response — NEVER hardcode
  const verifiedCurrency: string | null = paymentData.InvoiceDisplayValue
    ? paymentData.InvoiceDisplayValue.split(" ")?.[1] ?? paymentData.Currency ?? null
    : paymentData.Currency ?? null;

  // 6. Idempotency insert — ONLY after verification succeeds
  const { error: idErr } = await db.from("webhook_events").insert({
    provider: PROVIDER, provider_event_id: providerEventId, event_id: providerEventId,
    tenant_id: tenantId, payload_hash: payloadHash, raw_headers: rawHeaders,
    status: "received", signature_valid: true, received_at: new Date().toISOString(),
  });
  if (idErr?.code === "23505") return json({ ok: true, status: "duplicate" }, 200);

  await updateWebhookEvent(db, providerEventId, { status: "processing", signature_valid: true });

  // 7-9. Process payment
  const invoiceId = body?.CustomerReference ?? paymentData.CustomerReference ?? null;

  let paymentIntentId: string | null = null;
  let dbInvoiceId: string | null = invoiceId;

  // Resolve via payment_intents
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

      // Amount validation (1% tolerance)
      const expectedAmount = invoice.amount_due ?? invoice.grand_total;
      if (verifiedAmount !== null && expectedAmount !== null) {
        const tolerance = Math.max(expectedAmount * 0.01, 0.01);
        if (Math.abs(verifiedAmount - expectedAmount) > tolerance)
          throw new Error(`Amount mismatch: expected ${expectedAmount}, received ${verifiedAmount}`);
      }

      // Currency validation
      if (verifiedCurrency && invoice.currency && verifiedCurrency.toUpperCase() !== invoice.currency.toUpperCase())
        throw new Error(`Currency mismatch: expected ${invoice.currency}, received ${verifiedCurrency}`);

      if (invoice.status !== "paid") {
        await db.from("invoice_payments").insert({
          invoice_id: dbInvoiceId, tenant_id: tenantId,
          amount: verifiedAmount ?? expectedAmount,
          payment_method: "gateway_myfatoorah",
          payment_date: new Date().toISOString().split("T")[0],
          reference_number: providerEventId,
          notes: `دفع تلقائي عبر MyFatoorah — event: ${providerEventId}`,
          currency: verifiedCurrency ?? invoice.currency,
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
      invoice_id: dbInvoiceId, amount: verifiedAmount, currency: verifiedCurrency, is_paid: isPaid,
    });
  } catch (err: any) {
    processingError = err.message;
    console.error("[myfatoorah-webhook] processing error:", err);
    await updateWebhookEvent(db, providerEventId, { status: "failed", signature_valid: true, processing_error: processingError });
    await writeAudit(db, tenantId, "webhook_processing_failed", providerEventId, { error: processingError, invoice_id: dbInvoiceId });
    return json({ ok: false, status: "failed", error: processingError }, 200);
  }

  return json({ ok: true, status: isPaid ? "processed" : "received" }, 200);
}, 30000, corsHeaders));
