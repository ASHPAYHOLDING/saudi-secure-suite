/**
 * payment-webhook: Unified BYO-Gateway webhook endpoint
 *
 * URL format: /functions/v1/payment-webhook?provider=tap&tenant_id=<uuid>
 *
 * Security:
 * - Fetches per-tenant webhook_secret_encrypted and decrypts it
 * - Verifies provider-specific signature (hard reject if missing/invalid)
 * - Idempotency via webhook_events table (provider + event_id unique)
 * - Validates invoice exists, tenant matches, amount matches, currency matches
 * - Audit log on success and failure
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-tap-signature, x-moyasar-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const tenantIdParam = url.searchParams.get("tenant_id");

  if (!provider || !["tap", "moyasar", "hyperpay"].includes(provider)) {
    return json({ error: "Invalid or missing provider parameter" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const masterKey = Deno.env.get("INTEGRATION_SECRET_KEY") || "";

  const adminClient = createClient(supabaseUrl, serviceKey);

  // Read body as text for signature verification
  const bodyText = await req.text();
  let body: any;
  try { body = JSON.parse(bodyText); } catch { body = {}; }

  // Determine tenant_id from param or payload metadata
  let tenantId = tenantIdParam;
  if (!tenantId) {
    tenantId = body?.metadata?.tenant_id || body?.data?.metadata?.tenant_id || null;
  }

  if (!tenantId) {
    await auditLog(adminClient, null, provider, null, "webhook_rejected", { reason: "missing tenant_id" });
    return json({ error: "Cannot determine tenant_id" }, 400);
  }

  // Fetch tenant's provider record (webhook secret)
  const { data: providerRecord } = await adminClient
    .from("tenant_payment_providers")
    .select("webhook_secret_encrypted, status")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .single();

  if (!providerRecord) {
    await auditLog(adminClient, tenantId, provider, null, "webhook_rejected", { reason: "provider not configured for tenant" });
    return json({ error: "Provider not configured" }, 404);
  }

  if (!providerRecord.webhook_secret_encrypted) {
    await auditLog(adminClient, tenantId, provider, null, "webhook_rejected", { reason: "webhook_secret not configured" });
    return json({ error: "Webhook secret not configured. Cannot verify webhook." }, 400);
  }

  // Decrypt webhook secret
  let webhookSecret: string;
  try {
    webhookSecret = await decryptSecret(providerRecord.webhook_secret_encrypted, masterKey);
  } catch (err: any) {
    await auditLog(adminClient, tenantId, provider, null, "webhook_rejected", { reason: "decryption_failed: " + err.message });
    return json({ error: "Failed to decrypt webhook secret" }, 500);
  }

  // Verify signature per provider
  const sigResult = await verifySignature(req, bodyText, provider, webhookSecret);
  if (!sigResult.valid) {
    await auditLog(adminClient, tenantId, provider, null, "webhook_signature_failed", { reason: sigResult.reason });
    return json({ error: "Invalid webhook signature: " + sigResult.reason }, 401);
  }

  // Extract event_id and determine if paid
  let eventId: string;
  let isPaid = false;
  let sessionId = "";
  let invoiceId: string | null = null;
  let amount: number | null = null;
  let currency: string | null = null;

  if (provider === "tap") {
    eventId = body.id || body.charge_id || "";
    isPaid = body.status === "CAPTURED";
    sessionId = eventId;
    invoiceId = body.metadata?.invoice_id || null;
    amount = body.amount || null;
    currency = body.currency || null;
  } else if (provider === "moyasar") {
    eventId = body.id || "";
    isPaid = body.status === "paid";
    sessionId = eventId;
    invoiceId = body.metadata?.invoice_id || null;
    amount = body.amount ? body.amount / 100 : null; // Moyasar uses halalas
    currency = body.currency || null;
  } else if (provider === "hyperpay") {
    eventId = body.id || body.merchantTransactionId || "";
    const code = body.result?.code || "";
    isPaid = /^(000\.000\.|000\.100\.|000\.[36])/.test(code);
    sessionId = eventId;
    invoiceId = body.merchantTransactionId?.split("_")?.[1] || null;
    amount = body.amount ? parseFloat(body.amount) : null;
    currency = body.currency || null;
  } else {
    return json({ error: "Unsupported provider" }, 400);
  }

  if (!eventId) {
    await auditLog(adminClient, tenantId, provider, null, "webhook_rejected", { reason: "missing event_id" });
    return json({ error: "Cannot determine event ID from payload" }, 400);
  }

  // Idempotency check
  const { error: idempotencyErr } = await adminClient
    .from("webhook_events")
    .insert({
      provider,
      event_id: eventId,
      tenant_id: tenantId,
      payload: sanitize(body),
      status: "processing",
    });

  if (idempotencyErr) {
    if (idempotencyErr.code === "23505") {
      // Already processed
      return json({ ok: true, message: "Already processed (idempotent)" }, 200);
    }
    console.error("webhook_events insert error:", idempotencyErr);
    // Non-fatal, continue
  }

  // Find payment_intent or paid_gateway_transaction by session_id
  let paymentIntentId: string | null = null;
  let dbInvoiceId: string | null = invoiceId;
  let dbAmount: number | null = amount;
  let dbCurrency: string | null = currency;
  let dbTenantId: string = tenantId;

  // Try payment_intents table first (new BYO system)
  const { data: pi } = await adminClient
    .from("payment_intents")
    .select("id, invoice_id, amount, currency, tenant_id, status")
    .eq("provider_session_id", sessionId)
    .single();

  if (pi) {
    paymentIntentId = pi.id;
    dbInvoiceId = pi.invoice_id;
    dbAmount = pi.amount;
    dbCurrency = pi.currency;
    dbTenantId = pi.tenant_id;
  } else {
    // Fallback: try paid_gateway_transactions (legacy)
    const { data: tx } = await adminClient
      .from("paid_gateway_transactions")
      .select("id, invoice_id, amount, currency, tenant_id, status")
      .eq("session_id", sessionId)
      .single();

    if (tx) {
      dbInvoiceId = tx.invoice_id;
      dbAmount = tx.amount;
      dbCurrency = tx.currency;
      dbTenantId = tx.tenant_id;
    }
  }

  // CRITICAL: Validate tenant ownership
  if (dbTenantId !== tenantId) {
    await auditLog(adminClient, tenantId, provider, eventId, "webhook_rejected", {
      reason: "tenant_mismatch",
      expected: tenantId,
      actual: dbTenantId,
    });
    await markWebhookEvent(adminClient, provider, eventId, "rejected");
    return json({ error: "Tenant mismatch" }, 403);
  }

  // If we have an invoice, validate it
  if (dbInvoiceId && isPaid) {
    const { data: invoice } = await adminClient
      .from("invoices")
      .select("id, tenant_id, amount_due, currency, status")
      .eq("id", dbInvoiceId)
      .single();

    if (!invoice) {
      await auditLog(adminClient, tenantId, provider, eventId, "webhook_rejected", { reason: "invoice_not_found", invoice_id: dbInvoiceId });
      await markWebhookEvent(adminClient, provider, eventId, "rejected");
      return json({ error: "Invoice not found" }, 404);
    }

    if (invoice.tenant_id !== tenantId) {
      await auditLog(adminClient, tenantId, provider, eventId, "webhook_rejected", { reason: "invoice_tenant_mismatch" });
      await markWebhookEvent(adminClient, provider, eventId, "rejected");
      return json({ error: "Invoice tenant mismatch" }, 403);
    }

    // Amount validation (allow 1% tolerance for currency rounding)
    if (dbAmount !== null && invoice.amount_due !== null) {
      const tolerance = invoice.amount_due * 0.01;
      if (Math.abs(dbAmount - invoice.amount_due) > tolerance) {
        await auditLog(adminClient, tenantId, provider, eventId, "webhook_amount_mismatch", {
          expected: invoice.amount_due,
          received: dbAmount,
        });
        await markWebhookEvent(adminClient, provider, eventId, "rejected");
        return json({ error: "Amount mismatch" }, 400);
      }
    }

    // Currency validation
    if (dbCurrency && invoice.currency && dbCurrency.toUpperCase() !== invoice.currency.toUpperCase()) {
      await auditLog(adminClient, tenantId, provider, eventId, "webhook_currency_mismatch", {
        expected: invoice.currency,
        received: dbCurrency,
      });
      await markWebhookEvent(adminClient, provider, eventId, "rejected");
      return json({ error: "Currency mismatch" }, 400);
    }

    // All checks passed – mark invoice as paid
    if (invoice.status !== "paid") {
      await adminClient.from("invoice_payments").insert({
        invoice_id: dbInvoiceId,
        tenant_id: tenantId,
        amount: dbAmount || invoice.amount_due,
        payment_method: `gateway_${provider}`,
        payment_date: new Date().toISOString().split("T")[0],
        reference_number: eventId,
        notes: `دفع تلقائي عبر ${provider}`,
        created_by: "00000000-0000-0000-0000-000000000000",
      });
    }
  }

  // Update payment_intent status
  if (paymentIntentId) {
    await adminClient
      .from("payment_intents")
      .update({ status: isPaid ? "paid" : "failed", updated_at: new Date().toISOString() })
      .eq("id", paymentIntentId);
  }

  // Finalize webhook event
  const finalStatus = isPaid ? "completed" : "failed";
  await markWebhookEvent(adminClient, provider, eventId, finalStatus);
  await auditLog(adminClient, tenantId, provider, eventId, `webhook_${finalStatus}`, {
    invoice_id: dbInvoiceId,
    amount: dbAmount,
    currency: dbCurrency,
    is_paid: isPaid,
  });

  return json({ ok: true, status: finalStatus }, 200);
});

// ============ Signature Verification ============

async function verifySignature(
  req: Request,
  bodyText: string,
  provider: string,
  secret: string
): Promise<{ valid: boolean; reason?: string }> {
  if (provider === "tap") return verifyTap(req, bodyText, secret);
  if (provider === "moyasar") return verifyMoyasar(req, bodyText, secret);
  if (provider === "hyperpay") return verifyHyperPay(req, bodyText, secret);
  return { valid: false, reason: "Unknown provider" };
}

async function verifyTap(req: Request, body: string, secret: string): Promise<{ valid: boolean; reason?: string }> {
  // Tap uses hashid header: HMAC-SHA256 of body with secret
  const signature = req.headers.get("hashid") || req.headers.get("x-tap-signature") || req.headers.get("x-webhook-signature");
  if (!signature) return { valid: false, reason: "Missing Tap signature header (hashid)" };

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (!timingSafeEqual(signature.toLowerCase(), expected.toLowerCase())) {
    return { valid: false, reason: "Tap signature mismatch" };
  }
  return { valid: true };
}

async function verifyMoyasar(req: Request, body: string, secret: string): Promise<{ valid: boolean; reason?: string }> {
  // Moyasar uses X-Moyasar-Signature: HMAC-SHA256 hex of body
  const signature = req.headers.get("x-moyasar-signature") || req.headers.get("x-webhook-signature");
  if (!signature) return { valid: false, reason: "Missing Moyasar signature header (x-moyasar-signature)" };

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (!timingSafeEqual(signature.toLowerCase(), expected.toLowerCase())) {
    return { valid: false, reason: "Moyasar signature mismatch" };
  }
  return { valid: true };
}

async function verifyHyperPay(req: Request, body: string, secret: string): Promise<{ valid: boolean; reason?: string }> {
  // HyperPay uses X-Initialization-Vector + X-Authentication-Tag or simple HMAC
  // Standard: HMAC-SHA256 of body with webhook secret
  const signature = req.headers.get("x-webhook-signature") || req.headers.get("x-hyperpay-signature");
  if (!signature) return { valid: false, reason: "Missing HyperPay signature header (x-webhook-signature)" };

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (!timingSafeEqual(signature.toLowerCase(), expected.toLowerCase())) {
    return { valid: false, reason: "HyperPay signature mismatch" };
  }
  return { valid: true };
}

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============ Helpers ============

async function markWebhookEvent(supabase: any, provider: string, eventId: string, status: string) {
  await supabase
    .from("webhook_events")
    .update({ status, processed_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("event_id", eventId);
}

async function auditLog(supabase: any, tenantId: string | null, provider: string, eventId: string | null, action: string, details: any) {
  try {
    await supabase.from("audit_logs").insert({
      tenant_id: tenantId || "00000000-0000-0000-0000-000000000000",
      user_id: "00000000-0000-0000-0000-000000000000",
      action,
      entity_type: "payment_webhook",
      entity_label: provider,
      entity_id: eventId,
      changes: details,
    });
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

function sanitize(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  const s = { ...payload };
  for (const k of ["secretKey", "secret_key", "apiKey", "api_key", "password", "token", "authorization"]) {
    if (k in s) s[k] = "***REDACTED***";
  }
  return s;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
