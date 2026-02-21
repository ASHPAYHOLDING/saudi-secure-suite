import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "X-API-Version": "v1",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  // Path after /public-api/  e.g. /public-api/v1/invoices → /v1/invoices
  const pathParts = url.pathname.replace(/^\/public-api/, "").split("/").filter(Boolean);
  const version = pathParts[0]; // v1
  const resource = pathParts[1]; // invoices, customers
  const resourceId = pathParts[2]; // optional ID

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Authenticate via API Key ──
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return jsonResponse(401, { error: "Missing x-api-key header" }, corsHeaders);
  }

  // Hash the key for lookup
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: validation, error: valError } = await supabaseAdmin.rpc("validate_api_key", {
    _key_hash: keyHash,
  });

  if (valError || !validation?.valid) {
    return jsonResponse(401, { error: validation?.error || "Invalid API key" }, corsHeaders);
  }

  const tenantId = validation.tenant_id;
  const scopes: string[] = validation.scopes || [];
  const rateLimitPerMin = validation.rate_limit || 60;
  const keyId = validation.key_id;

  // ── Rate Limiting (simple sliding window) ──
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await supabaseAdmin
    .from("api_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", keyId)
    .gte("created_at", oneMinAgo);

  if ((recentCount || 0) >= rateLimitPerMin) {
    await logRequest(supabaseAdmin, tenantId, keyId, req.method, `/${resource}`, 429, Date.now() - startTime, req);
    return jsonResponse(429, {
      error: "Rate limit exceeded",
      limit: rateLimitPerMin,
      retry_after_seconds: 60,
    }, corsHeaders);
  }

  // ── Route ──
  if (version !== "v1") {
    await logRequest(supabaseAdmin, tenantId, keyId, req.method, url.pathname, 404, Date.now() - startTime, req);
    return jsonResponse(404, { error: "API version not found. Use /v1/" }, corsHeaders);
  }

  let response: Response;

  try {
    switch (resource) {
      case "invoices":
        response = await handleInvoices(supabaseAdmin, tenantId, scopes, req.method, resourceId, url);
        break;
      case "customers":
        response = await handleCustomers(supabaseAdmin, tenantId, scopes, req.method, resourceId, url);
        break;
      default:
        response = jsonResponse(404, {
          error: `Resource '${resource}' not found`,
          available: ["invoices", "customers"],
        }, corsHeaders);
    }
  } catch (err) {
    console.error("API error:", err);
    response = jsonResponse(500, { error: "Internal server error" }, corsHeaders);
  }

  // Log the request
  const statusCode = response.status;
  await logRequest(supabaseAdmin, tenantId, keyId, req.method, `/${resource}${resourceId ? `/${resourceId}` : ""}`, statusCode, Date.now() - startTime, req);

  return response;
});

// ── Handlers ──

async function handleInvoices(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  scopes: string[],
  method: string,
  id: string | undefined,
  url: URL
): Promise<Response> {
  if (!scopes.includes("read:invoices")) {
    return jsonResponse(403, { error: "Scope 'read:invoices' required" }, corsHeaders);
  }

  if (method !== "GET") {
    return jsonResponse(405, { error: "Only GET supported for invoices" }, corsHeaders);
  }

  if (id) {
    const { data, error } = await sb
      .from("invoices")
      .select("id, invoice_number, invoice_date, due_date, status, subtotal, vat_total, grand_total, currency, customer_id, notes, created_at")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) return jsonResponse(404, { error: "Invoice not found" }, corsHeaders);
    return jsonResponse(200, { data }, corsHeaders);
  }

  // List with pagination
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const status = url.searchParams.get("status");
  const from = (page - 1) * limit;

  let query = sb
    .from("invoices")
    .select("id, invoice_number, invoice_date, due_date, status, subtotal, vat_total, grand_total, currency, customer_id, created_at", { count: "exact" })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return jsonResponse(500, { error: "Failed to fetch invoices" }, corsHeaders);

  return jsonResponse(200, {
    data: data || [],
    meta: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
  }, corsHeaders);
}

async function handleCustomers(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  scopes: string[],
  method: string,
  id: string | undefined,
  url: URL
): Promise<Response> {
  if (!scopes.includes("read:customers")) {
    return jsonResponse(403, { error: "Scope 'read:customers' required" }, corsHeaders);
  }

  if (method !== "GET") {
    return jsonResponse(405, { error: "Only GET supported for customers" }, corsHeaders);
  }

  if (id) {
    const { data, error } = await sb
      .from("customers")
      .select("id, name, name_en, email, phone, vat_number, cr_number, customer_type, address_city, address_street, is_active, created_at")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .single();

    if (error || !data) return jsonResponse(404, { error: "Customer not found" }, corsHeaders);
    return jsonResponse(200, { data }, corsHeaders);
  }

  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const search = url.searchParams.get("search");
  const from = (page - 1) * limit;

  let query = sb
    .from("customers")
    .select("id, name, name_en, email, phone, vat_number, customer_type, is_active, created_at", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error) return jsonResponse(500, { error: "Failed to fetch customers" }, corsHeaders);

  return jsonResponse(200, {
    data: data || [],
    meta: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
  }, corsHeaders);
}

// ── Helpers ──

function jsonResponse(status: number, body: any, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function logRequest(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  keyId: string,
  method: string,
  path: string,
  statusCode: number,
  responseTimeMs: number,
  req: Request
) {
  try {
    await sb.from("api_request_logs").insert({
      tenant_id: tenantId,
      api_key_id: keyId,
      method,
      path,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
      user_agent: req.headers.get("user-agent")?.slice(0, 256) || null,
    });
  } catch (e) {
    console.error("Failed to log API request:", e);
  }
}
