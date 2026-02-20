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

  if (!["tap", "moyasar", "hyperpay", "stripe", "geidea", "paytabs", "myfatoorah"].includes(provider)) {
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

  // Webhook URL — dedicated endpoint per provider for Stripe/Geidea, shared for others
  const dedicatedProviders = ["stripe", "geidea"];
  const webhookUrl = dedicatedProviders.includes(provider)
    ? `${supabaseUrl}/functions/v1/${provider}-webhook?tenant_id=${tenantId}`
    : `${supabaseUrl}/functions/v1/payment-webhook?provider=${provider}&tenant_id=${tenantId}`;
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
      const r = await createHyperPaySession(credentials, { amount, currency, invoiceId, tenantId, webhookUrl });
      sessionId = r.id; paymentUrl = r.url; rawResponse = r.raw;
    } else if (provider === "stripe") {
      const appUrl = req.headers.get("origin") || "";
      const r = await createStripeSession(credentials, { amount, currency, invoiceId, tenantId, webhookUrl, customer, appUrl });
      sessionId = r.id; paymentUrl = r.url; rawResponse = r.raw;
    } else if (provider === "geidea") {
      const r = await createGeideaSession(credentials, { amount, currency, invoiceId, tenantId, webhookUrl });
      sessionId = r.id; paymentUrl = r.url; rawResponse = r.raw;
    } else if (provider === "paytabs") {
      const r = await createPayTabsSession(credentials, { amount, currency, invoiceId, tenantId, webhookUrl, customer });
      sessionId = r.id; paymentUrl = r.url; rawResponse = r.raw;
    } else if (provider === "myfatoorah") {
      const r = await createMyFatoorahSession(credentials, { amount, currency, invoiceId, tenantId, webhookUrl });
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
  // Support both "entityId:token" combined format and separate fields
  let token = accessToken;
  let eid = entityId;
  if (!eid && accessToken.includes(":")) {
    const parts = accessToken.split(":");
    eid = parts[0];
    token = parts.slice(1).join(":");
  }

  const shopperResultUrl = opts.webhookUrl || "";
  const params = new URLSearchParams({
    entityId: eid,
    amount: opts.amount.toFixed(2),
    currency: opts.currency,
    paymentType: "DB",
    merchantTransactionId: opts.invoiceId.slice(0, 32),
    "customParameters[invoice_id]": opts.invoiceId,
    "customParameters[tenant_id]": opts.tenantId,
  });
  if (shopperResultUrl) params.set("shopperResultUrl", shopperResultUrl);

  const baseUrl = creds.sandbox === true
    ? "https://eu-test.oppwa.com"
    : "https://eu-prod.oppwa.com";

  const res = await fetch(`${baseUrl}/v1/checkouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const d = await res.json();
  if (!res.ok || !d.id) throw new Error(d.result?.description || "HyperPay API error");

  // Build hosted payment page URL — standard HyperPay HPP redirect
  const hppUrl = `${baseUrl}/v1/hpp/${d.id}/page?entityId=${eid}`;
  return { id: d.id, url: hppUrl, raw: d };
}

async function createPayTabsSession(creds: any, opts: any) {
  const profileId = creds.profile_id || "";
  const serverKey = creds.server_key || creds.api_key || "";
  const region = (creds.region || "SAU").toUpperCase();

  // Determine endpoint by region
  const regionEndpoints: Record<string, string> = {
    SAU: "https://secure.paytabs.sa",
    ARE: "https://secure.paytabs.com",
    EGY: "https://secure-egypt.paytabs.com",
    JOR: "https://secure-jordan.paytabs.com",
    OMN: "https://secure-oman.paytabs.com",
    IRQ: "https://secure-iraq.paytabs.com",
    PAK: "https://secure-pakistan.paytabs.com",
  };
  const endpoint = regionEndpoints[region] || regionEndpoints["SAU"];

  const callbackUrl = opts.webhookUrl || "";
  const returnUrl = opts.webhookUrl || "";
  const customerName = opts.customer?.name || "Customer";
  const customerEmail = opts.customer?.email || "noreply@numaxio.com";
  const customerPhone = opts.customer?.phone || "0000000000";

  const body = {
    profile_id: Number(profileId),
    tran_type: "sale",
    tran_class: "ecom",
    cart_id: opts.invoiceId.slice(0, 64),
    cart_currency: opts.currency || "SAR",
    cart_amount: opts.amount,
    cart_description: `فاتورة ${opts.invoiceId.slice(0, 20)}`,
    customer_details: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      street1: "N/A",
      city: "Riyadh",
      state: "Riyadh",
      country: "SA",
      zip: "12345",
    },
    shipping_details: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      street1: "N/A",
      city: "Riyadh",
      state: "Riyadh",
      country: "SA",
      zip: "12345",
    },
    callback: callbackUrl,
    return: returnUrl,
    metadata: { invoice_id: opts.invoiceId, tenant_id: opts.tenantId },
  };

  const res = await fetch(`${endpoint}/payment/request`, {
    method: "POST",
    headers: {
      Authorization: serverKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const d = await res.json();
  if (!res.ok || !d.redirect_url) throw new Error(d.message || d.details?.toString() || "PayTabs API error");
  return { id: d.tran_ref || opts.invoiceId, url: d.redirect_url, raw: d };
}

async function createMyFatoorahSession(creds: any, opts: any) {
  const apiKey = creds.api_key || creds.token || "";
  const countryCode = (creds.country_code || "SAU").toUpperCase();

  // MyFatoorah base URLs by country
  const countryEndpoints: Record<string, string> = {
    SAU: "https://api.myfatoorah.com",
    KWT: "https://api-kw.myfatoorah.com",
    ARE: "https://api.myfatoorah.com",
    QAT: "https://api-qa.myfatoorah.com",
    BHR: "https://api-bh.myfatoorah.com",
    OMN: "https://api-om.myfatoorah.com",
  };
  const baseUrl = countryEndpoints[countryCode] || countryEndpoints["SAU"];

  // Step 1: Initiate payment to get payment methods
  const initRes = await fetch(`${baseUrl}/v2/InitiatePayment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      InvoiceAmount: opts.amount,
      CurrencyIso: opts.currency || "SAR",
    }),
  });
  const initData = await initRes.json();
  if (!initRes.ok || !initData.IsSuccess) {
    throw new Error(initData.Message || "MyFatoorah InitiatePayment error");
  }

  // Find a supported payment method (MADA=2, Visa=1, default to 1)
  const methods: any[] = initData.Data?.PaymentMethods || [];
  const method = methods.find((m: any) => m.PaymentMethodEn === "MADA") ||
    methods.find((m: any) => m.PaymentMethodEn === "Visa") ||
    methods[0];
  const paymentMethodId = method?.PaymentMethodId || 1;

  // Step 2: Execute payment to get the invoice URL
  const exRes = await fetch(`${baseUrl}/v2/ExecutePayment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      PaymentMethodId: paymentMethodId,
      CustomerName: opts.customer?.name || "Customer",
      DisplayCurrencyIso: opts.currency || "SAR",
      MobileCountryCode: "+966",
      CustomerMobile: opts.customer?.phone || "0500000000",
      CustomerEmail: opts.customer?.email || "noreply@numaxio.com",
      InvoiceValue: opts.amount,
      CallBackUrl: opts.webhookUrl,
      ErrorUrl: opts.webhookUrl,
      Language: "AR",
      CustomerReference: opts.invoiceId.slice(0, 50),
      UserDefinedField: opts.tenantId.slice(0, 50),
    }),
  });
  const exData = await exRes.json();
  if (!exRes.ok || !exData.IsSuccess) {
    throw new Error(exData.Message || "MyFatoorah ExecutePayment error");
  }

  const invoiceUrl = exData.Data?.PaymentURL || exData.Data?.InvoiceURL || "";
  const invoiceId = String(exData.Data?.InvoiceId || opts.invoiceId);
  if (!invoiceUrl) throw new Error("No payment URL returned from MyFatoorah");
  return { id: invoiceId, url: invoiceUrl, raw: exData.Data };
}

async function createStripeSession(creds: any, opts: any) {
  const secretKey = creds.secret_key || creds.api_key || "";

  // Determine success/cancel URLs — use a generic hosted page if not provided
  const successUrl = opts.successUrl || `${opts.appUrl || "https://saudi-secure-suite.lovable.app"}/dashboard/invoices?payment=success&invoice_id=${opts.invoiceId}`;
  const cancelUrl  = opts.cancelUrl  || `${opts.appUrl || "https://saudi-secure-suite.lovable.app"}/dashboard/invoices?payment=cancelled&invoice_id=${opts.invoiceId}`;

  // Use Stripe Checkout Session — gives a hosted payment page URL
  const params = new URLSearchParams({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": (opts.currency || "SAR").toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(Math.round(opts.amount * 100)), // Stripe uses smallest unit (halalas)
    "line_items[0][price_data][product_data][name]": `فاتورة ${opts.invoiceId.slice(0, 20)}`,
    "line_items[0][quantity]": "1",
    "mode": "payment",
    "success_url": successUrl,
    "cancel_url": cancelUrl,
    "metadata[invoice_id]": opts.invoiceId,
    "metadata[tenant_id]": opts.tenantId,
  });

  // Attach customer email if available
  if (opts.customer?.email) {
    params.set("customer_email", opts.customer.email);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const d = await res.json();
  if (!res.ok || !d.id) throw new Error(d.error?.message || "Stripe Checkout Session API error");

  // Return hosted checkout URL directly — frontend just opens this URL
  return {
    id: d.id,
    url: d.url,  // Stripe-hosted checkout page URL
    raw: { sessionId: d.id, payment_status: d.payment_status, url: d.url },
  };
}

async function createGeideaSession(creds: any, opts: any) {
  const merchantPublicKey = creds.merchant_public_key || creds.api_key || "";
  const apiPassword = creds.api_password || creds.secret_key || "";

  // Geidea Session API
  const merchantRef = `inv_${opts.invoiceId.slice(0, 20)}_tenant_${opts.tenantId.slice(0, 8)}`;
  const res = await fetch("https://api.merchant.geidea.net/payment-intent/api/v2/direct/session", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${merchantPublicKey}:${apiPassword}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: opts.amount,
      currency: opts.currency || "SAR",
      merchantReferenceId: merchantRef,
      callbackUrl: opts.webhookUrl,
      returnUrl: opts.webhookUrl,
      language: "ar",
    }),
  });
  const d = await res.json();
  if (!res.ok || !d.session?.id) throw new Error(d.responseMessage || "Geidea API error");
  return {
    id: d.session.id,
    url: `https://api.merchant.geidea.net/payment-intent/api/v2/direct/session/${d.session.id}`,
    raw: { sessionId: d.session.id, merchantRef },
  };
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
