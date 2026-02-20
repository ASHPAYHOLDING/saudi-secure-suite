/**
 * payment-create-intent: Creates a payment session using tenant's own credentials
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptSecret } from "../_shared/aes-gcm.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const masterKey = Deno.env.get("INTEGRATION_SECRET_KEY") || "";

  const adminClient = createClient(supabaseUrl, serviceKey);

  // Rate limiting
  const blocked = await checkRateLimit(req, adminClient, "payment_create_intent", corsHeaders);
  if (blocked) return blocked;

  // Auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) return json({ error: "Invalid token" }, 401);

  // Get tenant
  const { data: member } = await adminClient
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member) return json({ error: "No tenant found" }, 403);
  const tenantId = member.tenant_id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { provider, invoiceId } = body;

  if (!["tap", "moyasar", "hyperpay"].includes(provider)) {
    return json({ error: "Invalid provider" }, 400);
  }
  if (!invoiceId) return json({ error: "invoiceId is required" }, 400);

  // Fetch invoice and validate tenant ownership
  const { data: invoice } = await adminClient
    .from("invoices")
    .select("id, invoice_number, amount_due, currency, tenant_id, customers(name, email, phone)")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .single();

  if (!invoice) return json({ error: "Invoice not found or unauthorized" }, 404);
  if (invoice.amount_due <= 0) return json({ error: "Invoice already fully paid" }, 400);

  // Fetch provider record
  const { data: providerRecord } = await adminClient
    .from("tenant_payment_providers")
    .select("credentials_encrypted, status")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .single();

  if (!providerRecord || !providerRecord.credentials_encrypted) {
    return json({ error: "Payment provider not configured. Please set up your credentials first." }, 400);
  }

  if (!["tested", "active"].includes(providerRecord.status)) {
    return json({ error: "Payment provider not activated. Please test the connection first." }, 400);
  }

  // Decrypt credentials
  let credentials: any;
  try {
    const dec = await decryptSecret(providerRecord.credentials_encrypted, masterKey);
    credentials = JSON.parse(dec);
  } catch (err: any) {
    return json({ error: "Failed to decrypt credentials: " + err.message }, 500);
  }

  // Webhook URL for this tenant
  const webhookUrl = `${supabaseUrl}/functions/v1/payment-webhook?provider=${provider}&tenant_id=${tenantId}`;
  const amount = invoice.amount_due;
  const currency = invoice.currency || "SAR";
  const customer = invoice.customers as any;

  let sessionId = "";
  let paymentUrl = "";
  let rawResponse: any = {};

  try {
    if (provider === "tap") {
      const r = await createTapSession(credentials, { amount, currency, invoiceId, tenantId, webhookUrl, customer });
      sessionId = r.id; paymentUrl = r.url; rawResponse = r.raw;
    } else if (provider === "moyasar") {
      const r = await createMoyasarSession(credentials, { amount, currency, invoiceId, tenantId, webhookUrl });
      sessionId = r.id; paymentUrl = r.url; rawResponse = r.raw;
    } else if (provider === "hyperpay") {
      const r = await createHyperPaySession(credentials, { amount, currency, invoiceId, tenantId });
      sessionId = r.id; paymentUrl = r.url; rawResponse = r.raw;
    }
  } catch (err: any) {
    return json({ error: "Gateway error: " + err.message }, 502);
  }

  // Store payment intent
  const { data: pi, error: piErr } = await adminClient
    .from("payment_intents")
    .insert({
      tenant_id: tenantId,
      provider,
      provider_session_id: sessionId,
      invoice_id: invoiceId,
      amount,
      currency,
      status: "pending",
      metadata: { webhook_url: webhookUrl, raw: rawResponse },
    })
    .select("id")
    .single();

  if (piErr) console.error("Failed to store payment_intent:", piErr);

  return json({ paymentUrl, sessionId, paymentIntentId: pi?.id }, 200);
});

async function createTapSession(creds: any, opts: any) {
  const secretKey = creds.secret_key || creds.api_key || "";
  const res = await fetch("https://api.tap.company/v2/charges", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: opts.amount, currency: opts.currency,
      customer: { first_name: opts.customer?.name || "Customer", email: opts.customer?.email || undefined },
      source: { id: "src_all" },
      redirect: { url: opts.webhookUrl },
      post: { url: opts.webhookUrl },
      metadata: { invoice_id: opts.invoiceId, tenant_id: opts.tenantId },
    }),
  });
  const d = await res.json();
  if (!res.ok || !d.id) throw new Error(d.message || "Tap API error");
  return { id: d.id, url: d.transaction?.url || d.redirect?.url || "", raw: d };
}

async function createMoyasarSession(creds: any, opts: any) {
  const secretKey = creds.secret_key || creds.api_key || "";
  const res = await fetch("https://api.moyasar.com/v1/invoices", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(secretKey + ":")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(opts.amount * 100),
      currency: opts.currency,
      description: `Invoice ${opts.invoiceId}`,
      callback_url: opts.webhookUrl,
      metadata: { invoice_id: opts.invoiceId, tenant_id: opts.tenantId },
    }),
  });
  const d = await res.json();
  if (!res.ok || !d.id) throw new Error(d.message || "Moyasar API error");
  return { id: d.id, url: d.url || "", raw: d };
}

async function createHyperPaySession(creds: any, opts: any) {
  const accessToken = creds.access_token || creds.api_key || "";
  const entityId = creds.entity_id || "";
  const token = accessToken.includes(":") ? accessToken.split(":")[1] : accessToken;
  const eid = entityId || accessToken.split(":")[0] || "";

  const params = new URLSearchParams({
    entityId: eid,
    amount: opts.amount.toFixed(2),
    currency: opts.currency,
    paymentType: "DB",
    merchantTransactionId: opts.invoiceId.slice(0, 32),
  });

  const res = await fetch("https://eu-prod.oppwa.com/v1/checkouts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const d = await res.json();
  if (!res.ok || !d.id) throw new Error(d.result?.description || "HyperPay API error");
  return { id: d.id, url: `https://eu-prod.oppwa.com/v1/paymentWidgets.js?checkoutId=${d.id}`, raw: d };
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
