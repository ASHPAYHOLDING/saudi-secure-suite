import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ── Scope Definitions ──
const VALID_SCOPES = [
  "billing.read", "billing.write",
  "accounting.read", "accounting.write",
  "inventory.read", "inventory.manage",
  "crm.read", "crm.write",
  "hr.read", "hr.write",
  // Legacy scopes (backward compat)
  "read:invoices", "read:customers",
] as const;

// Map new domain scopes to legacy scopes for backward compatibility
const SCOPE_MAPPING: Record<string, string[]> = {
  "billing.read": ["read:invoices", "billing.read"],
  "billing.write": ["billing.write"],
  "crm.read": ["read:customers", "crm.read"],
  "crm.write": ["crm.write"],
  "accounting.read": ["accounting.read"],
  "accounting.write": ["accounting.write"],
  "inventory.read": ["inventory.read"],
  "inventory.manage": ["inventory.read", "inventory.manage"],
  "hr.read": ["hr.read"],
  "hr.write": ["hr.write"],
};

function hasScope(userScopes: string[], required: string): boolean {
  if (userScopes.includes(required)) return true;
  // Check if any user scope implies the required one
  for (const s of userScopes) {
    const implied = SCOPE_MAPPING[s];
    if (implied && implied.includes(required)) return true;
  }
  // Legacy compat
  if (required === "billing.read" && userScopes.includes("read:invoices")) return true;
  if (required === "crm.read" && userScopes.includes("read:customers")) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/public-api/, "").split("/").filter(Boolean);
  const version = pathParts[0]; // v1 or v2
  const resource = pathParts[1];
  const resourceId = pathParts[2];
  const subResource = pathParts[3];

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Authenticate via API Key ──
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return jsonRes(401, { error: "Missing x-api-key header", code: "MISSING_API_KEY" });
  }

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: validation, error: valError } = await supabaseAdmin.rpc("validate_api_key", {
    _key_hash: keyHash,
  });

  if (valError || !validation?.valid) {
    return jsonRes(401, { error: validation?.error || "Invalid API key", code: "INVALID_API_KEY" });
  }

  const tenantId: string = validation.tenant_id;
  const scopes: string[] = validation.scopes || [];
  const rateLimitPerMin: number = validation.rate_limit || 60;
  const keyId: string = validation.key_id;
  const tier: string = validation.tier || "basic";

  // ── Per-Tenant Rate Limiting ──
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await supabaseAdmin
    .from("api_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", keyId)
    .gte("created_at", oneMinAgo);

  if ((recentCount || 0) >= rateLimitPerMin) {
    await logRequest(supabaseAdmin, {
      tenantId, keyId, method: req.method, path: `/${resource}`,
      statusCode: 429, latencyMs: Date.now() - startTime, req,
      version, resource, resourceId, scopesUsed: [],
      errorMessage: "Rate limit exceeded",
    });
    return jsonRes(429, {
      error: "Rate limit exceeded",
      code: "RATE_LIMITED",
      limit: rateLimitPerMin,
      tier,
      retry_after_seconds: 60,
    }, { "Retry-After": "60", "X-RateLimit-Limit": String(rateLimitPerMin) });
  }

  // ── Version Routing ──
  if (version !== "v1" && version !== "v2") {
    await logRequest(supabaseAdmin, {
      tenantId, keyId, method: req.method, path: url.pathname,
      statusCode: 404, latencyMs: Date.now() - startTime, req,
      version, resource, resourceId, scopesUsed: [],
      errorMessage: "Version not found",
    });
    return jsonRes(404, {
      error: "API version not found. Available: /v1/, /v2/",
      code: "VERSION_NOT_FOUND",
      available_versions: ["v1", "v2"],
    });
  }

  let response: Response;
  const usedScopes: string[] = [];

  try {
    if (version === "v1") {
      response = await routeV1(supabaseAdmin, tenantId, scopes, usedScopes, req.method, resource, resourceId, url);
    } else {
      response = await routeV2(supabaseAdmin, tenantId, scopes, usedScopes, req.method, resource, resourceId, subResource, url, req);
    }
  } catch (err: any) {
    console.error("API error:", err);
    response = jsonRes(500, { error: "Internal server error", code: "INTERNAL_ERROR" });
  }

  const latencyMs = Date.now() - startTime;
  await logRequest(supabaseAdmin, {
    tenantId, keyId, method: req.method,
    path: `/${resource}${resourceId ? `/${resourceId}` : ""}${subResource ? `/${subResource}` : ""}`,
    statusCode: response.status, latencyMs, req, version, resource, resourceId,
    scopesUsed: usedScopes,
    errorMessage: response.status >= 400 ? `HTTP ${response.status}` : undefined,
    requestBodySize: req.headers.get("content-length") ? parseInt(req.headers.get("content-length")!) : undefined,
  });

  // Add standard headers
  const headers = new Headers(response.headers);
  headers.set("X-API-Version", version);
  headers.set("X-Request-Latency-Ms", String(latencyMs));
  headers.set("X-RateLimit-Limit", String(rateLimitPerMin));
  headers.set("X-RateLimit-Remaining", String(Math.max(0, rateLimitPerMin - (recentCount || 0) - 1)));
  headers.set("X-Tier", tier);

  return new Response(response.body, { status: response.status, headers });
});

// ══════════════════════════════════════════════════════════════════════════════
// V1 ROUTER (backward compatible)
// ══════════════════════════════════════════════════════════════════════════════

async function routeV1(
  sb: ReturnType<typeof createClient>, tenantId: string, scopes: string[],
  usedScopes: string[], method: string, resource: string, id: string | undefined, url: URL
): Promise<Response> {
  switch (resource) {
    case "invoices":
      return handleInvoicesV1(sb, tenantId, scopes, usedScopes, method, id, url);
    case "customers":
      return handleCustomersV1(sb, tenantId, scopes, usedScopes, method, id, url);
    default:
      return jsonRes(404, {
        error: `Resource '${resource}' not found`,
        code: "RESOURCE_NOT_FOUND",
        available: ["invoices", "customers"],
      });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// V2 ROUTER (domain-scoped, expanded resources)
// ══════════════════════════════════════════════════════════════════════════════

async function routeV2(
  sb: ReturnType<typeof createClient>, tenantId: string, scopes: string[],
  usedScopes: string[], method: string, resource: string, id: string | undefined,
  subResource: string | undefined, url: URL, req: Request
): Promise<Response> {
  switch (resource) {
    // ── Billing Domain ──
    case "invoices":
      return handleInvoicesV2(sb, tenantId, scopes, usedScopes, method, id, url, req);
    case "payments":
      return handlePaymentsV2(sb, tenantId, scopes, usedScopes, method, id, url);

    // ── CRM Domain ──
    case "customers":
      return handleCustomersV2(sb, tenantId, scopes, usedScopes, method, id, url, req);

    // ── Accounting Domain ──
    case "journals":
      return handleJournalsV2(sb, tenantId, scopes, usedScopes, method, id, url);
    case "accounts":
      return handleAccountsV2(sb, tenantId, scopes, usedScopes, method, url);

    // ── Inventory Domain ──
    case "products":
      return handleProductsV2(sb, tenantId, scopes, usedScopes, method, id, url);

    default:
      return jsonRes(404, {
        error: `Resource '${resource}' not found`,
        code: "RESOURCE_NOT_FOUND",
        available: ["invoices", "payments", "customers", "journals", "accounts", "products"],
      });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// V1 HANDLERS (unchanged behavior, legacy scope names)
// ══════════════════════════════════════════════════════════════════════════════

async function handleInvoicesV1(
  sb: any, tenantId: string, scopes: string[], usedScopes: string[],
  method: string, id: string | undefined, url: URL
): Promise<Response> {
  if (!hasScope(scopes, "billing.read") && !scopes.includes("read:invoices")) {
    return jsonRes(403, { error: "Scope 'billing.read' required", code: "INSUFFICIENT_SCOPE" });
  }
  usedScopes.push("billing.read");

  if (method !== "GET") return jsonRes(405, { error: "Only GET supported in v1", code: "METHOD_NOT_ALLOWED" });

  if (id) {
    const { data, error } = await sb.from("invoices")
      .select("id, invoice_number, invoice_date, due_date, status, subtotal, vat_total, grand_total, currency, customer_id, notes, created_at")
      .eq("tenant_id", tenantId).eq("id", id).is("deleted_at", null).single();
    if (error || !data) return jsonRes(404, { error: "Invoice not found", code: "NOT_FOUND" });
    return jsonRes(200, { data });
  }

  return paginatedQuery(sb, "invoices", tenantId, url,
    "id, invoice_number, invoice_date, due_date, status, subtotal, vat_total, grand_total, currency, customer_id, created_at",
    { deleted_at: null }
  );
}

async function handleCustomersV1(
  sb: any, tenantId: string, scopes: string[], usedScopes: string[],
  method: string, id: string | undefined, url: URL
): Promise<Response> {
  if (!hasScope(scopes, "crm.read") && !scopes.includes("read:customers")) {
    return jsonRes(403, { error: "Scope 'crm.read' required", code: "INSUFFICIENT_SCOPE" });
  }
  usedScopes.push("crm.read");

  if (method !== "GET") return jsonRes(405, { error: "Only GET supported in v1", code: "METHOD_NOT_ALLOWED" });

  if (id) {
    const { data, error } = await sb.from("customers")
      .select("id, name, name_en, email, phone, vat_number, cr_number, customer_type, address_city, address_street, is_active, created_at")
      .eq("tenant_id", tenantId).eq("id", id).single();
    if (error || !data) return jsonRes(404, { error: "Customer not found", code: "NOT_FOUND" });
    return jsonRes(200, { data });
  }

  return paginatedQuery(sb, "customers", tenantId, url,
    "id, name, name_en, email, phone, vat_number, customer_type, is_active, created_at"
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// V2 HANDLERS (domain-scoped, read+write, richer responses)
// ══════════════════════════════════════════════════════════════════════════════

async function handleInvoicesV2(
  sb: any, tenantId: string, scopes: string[], usedScopes: string[],
  method: string, id: string | undefined, url: URL, req: Request
): Promise<Response> {
  if (method === "GET") {
    if (!hasScope(scopes, "billing.read")) return scopeError("billing.read");
    usedScopes.push("billing.read");

    if (id) {
      const { data, error } = await sb.from("invoices")
        .select("id, invoice_number, invoice_date, due_date, status, subtotal, discount_amount, vat_total, grand_total, currency, currency_code, customer_id, branch_id, notes, payment_terms, created_at, updated_at")
        .eq("tenant_id", tenantId).eq("id", id).is("deleted_at", null).single();
      if (error || !data) return jsonRes(404, { error: "Invoice not found", code: "NOT_FOUND" });
      return jsonRes(200, { data, _version: "v2" });
    }

    return paginatedQuery(sb, "invoices", tenantId, url,
      "id, invoice_number, invoice_date, due_date, status, subtotal, vat_total, grand_total, currency, customer_id, branch_id, created_at, updated_at",
      { deleted_at: null }, "_version", "v2"
    );
  }

  if (method === "POST") {
    if (!hasScope(scopes, "billing.write")) return scopeError("billing.write");
    usedScopes.push("billing.write");
    return jsonRes(501, { error: "Invoice creation via API coming soon", code: "NOT_IMPLEMENTED" });
  }

  return jsonRes(405, { error: `Method ${method} not supported`, code: "METHOD_NOT_ALLOWED" });
}

async function handlePaymentsV2(
  sb: any, tenantId: string, scopes: string[], usedScopes: string[],
  method: string, id: string | undefined, url: URL
): Promise<Response> {
  if (!hasScope(scopes, "billing.read")) return scopeError("billing.read");
  usedScopes.push("billing.read");
  if (method !== "GET") return jsonRes(405, { error: "Only GET supported", code: "METHOD_NOT_ALLOWED" });

  if (id) {
    const { data, error } = await sb.from("invoice_payments")
      .select("id, invoice_id, amount, payment_date, payment_method, reference_number, status, notes, created_at")
      .eq("tenant_id", tenantId).eq("id", id).single();
    if (error || !data) return jsonRes(404, { error: "Payment not found", code: "NOT_FOUND" });
    return jsonRes(200, { data, _version: "v2" });
  }

  return paginatedQuery(sb, "invoice_payments", tenantId, url,
    "id, invoice_id, amount, payment_date, payment_method, status, created_at",
    {}, "_version", "v2"
  );
}

async function handleCustomersV2(
  sb: any, tenantId: string, scopes: string[], usedScopes: string[],
  method: string, id: string | undefined, url: URL, req: Request
): Promise<Response> {
  if (method === "GET") {
    if (!hasScope(scopes, "crm.read")) return scopeError("crm.read");
    usedScopes.push("crm.read");

    if (id) {
      const { data, error } = await sb.from("customers")
        .select("id, name, name_en, email, phone, vat_number, cr_number, customer_type, address_city, address_street, address_zip, is_active, credit_limit, payment_terms, created_at, updated_at")
        .eq("tenant_id", tenantId).eq("id", id).single();
      if (error || !data) return jsonRes(404, { error: "Customer not found", code: "NOT_FOUND" });
      return jsonRes(200, { data, _version: "v2" });
    }

    return paginatedQuery(sb, "customers", tenantId, url,
      "id, name, name_en, email, phone, vat_number, customer_type, is_active, created_at, updated_at",
      {}, "_version", "v2"
    );
  }

  if (method === "POST") {
    if (!hasScope(scopes, "crm.write")) return scopeError("crm.write");
    usedScopes.push("crm.write");
    return jsonRes(501, { error: "Customer creation via API coming soon", code: "NOT_IMPLEMENTED" });
  }

  return jsonRes(405, { error: `Method ${method} not supported`, code: "METHOD_NOT_ALLOWED" });
}

async function handleJournalsV2(
  sb: any, tenantId: string, scopes: string[], usedScopes: string[],
  method: string, id: string | undefined, url: URL
): Promise<Response> {
  if (!hasScope(scopes, "accounting.read")) return scopeError("accounting.read");
  usedScopes.push("accounting.read");
  if (method !== "GET") return jsonRes(405, { error: "Only GET supported", code: "METHOD_NOT_ALLOWED" });

  if (id) {
    const { data, error } = await sb.from("journal_entries")
      .select("id, entry_number, entry_date, description, status, total_debit, total_credit, reference_type, reference_id, created_at")
      .eq("tenant_id", tenantId).eq("id", id).single();
    if (error || !data) return jsonRes(404, { error: "Journal entry not found", code: "NOT_FOUND" });
    return jsonRes(200, { data, _version: "v2" });
  }

  return paginatedQuery(sb, "journal_entries", tenantId, url,
    "id, entry_number, entry_date, description, status, total_debit, total_credit, created_at",
    {}, "_version", "v2"
  );
}

async function handleAccountsV2(
  sb: any, tenantId: string, scopes: string[], usedScopes: string[],
  method: string, url: URL
): Promise<Response> {
  if (!hasScope(scopes, "accounting.read")) return scopeError("accounting.read");
  usedScopes.push("accounting.read");
  if (method !== "GET") return jsonRes(405, { error: "Only GET supported", code: "METHOD_NOT_ALLOWED" });

  return paginatedQuery(sb, "coa_accounts", tenantId, url,
    "id, code, name, name_en, account_type, is_postable, parent_id, sort_order",
    {}, "_version", "v2"
  );
}

async function handleProductsV2(
  sb: any, tenantId: string, scopes: string[], usedScopes: string[],
  method: string, id: string | undefined, url: URL
): Promise<Response> {
  if (!hasScope(scopes, "inventory.read")) return scopeError("inventory.read");
  usedScopes.push("inventory.read");
  if (method !== "GET") return jsonRes(405, { error: "Only GET supported for now", code: "METHOD_NOT_ALLOWED" });

  if (id) {
    const { data, error } = await sb.from("products")
      .select("id, name, name_en, sku, barcode, unit_price, cost_price, quantity, unit, category, is_active, created_at")
      .eq("tenant_id", tenantId).eq("id", id).single();
    if (error || !data) return jsonRes(404, { error: "Product not found", code: "NOT_FOUND" });
    return jsonRes(200, { data, _version: "v2" });
  }

  return paginatedQuery(sb, "products", tenantId, url,
    "id, name, name_en, sku, barcode, unit_price, quantity, unit, category, is_active, created_at",
    {}, "_version", "v2"
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function jsonRes(status: number, body: any, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function scopeError(scope: string): Response {
  return jsonRes(403, { error: `Scope '${scope}' required`, code: "INSUFFICIENT_SCOPE", required_scope: scope });
}

async function paginatedQuery(
  sb: any, table: string, tenantId: string, url: URL, select: string,
  filters: Record<string, any> = {}, extraKey?: string, extraValue?: string
): Promise<Response> {
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const search = url.searchParams.get("search");
  const status = url.searchParams.get("status");
  const sortBy = url.searchParams.get("sort_by") || "created_at";
  const sortDir = url.searchParams.get("sort_dir") === "asc";
  const from = (page - 1) * limit;

  let query = sb.from(table)
    .select(select, { count: "exact" })
    .eq("tenant_id", tenantId)
    .order(sortBy, { ascending: sortDir })
    .range(from, from + limit - 1);

  for (const [k, v] of Object.entries(filters)) {
    if (v === null) query = query.is(k, null);
    else query = query.eq(k, v);
  }
  if (status) query = query.eq("status", status);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error) return jsonRes(500, { error: `Failed to fetch ${table}`, code: "QUERY_ERROR" });

  const result: any = {
    data: data || [],
    meta: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
  };
  if (extraKey) result[extraKey] = extraValue;
  return jsonRes(200, result);
}

interface LogParams {
  tenantId: string; keyId: string; method: string; path: string;
  statusCode: number; latencyMs: number; req: Request;
  version?: string; resource?: string; resourceId?: string;
  scopesUsed?: string[]; errorMessage?: string; requestBodySize?: number;
}

async function logRequest(sb: any, p: LogParams) {
  try {
    await sb.from("api_request_logs").insert({
      tenant_id: p.tenantId,
      api_key_id: p.keyId,
      method: p.method,
      path: p.path,
      status_code: p.statusCode,
      response_time_ms: p.latencyMs,
      ip_address: p.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || p.req.headers.get("cf-connecting-ip") || null,
      user_agent: p.req.headers.get("user-agent")?.slice(0, 256) || null,
      api_version: p.version || "v1",
      resource: p.resource || null,
      resource_id: p.resourceId || null,
      scopes_used: p.scopesUsed?.length ? p.scopesUsed : null,
      error_message: p.errorMessage || null,
      request_body_size: p.requestBodySize || null,
    });
  } catch (e) {
    console.error("Failed to log API request:", e);
  }
}
