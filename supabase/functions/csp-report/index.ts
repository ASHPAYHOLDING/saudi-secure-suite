import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(null, { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // CSP reports come in two formats:
    // 1) {"csp-report": {...}}  (report-uri format)
    // 2) {"type":"csp-violation", "body": {...}}  (report-to format)
    const report = body["csp-report"] ?? body?.body ?? body;

    const violated_directive =
      report["violated-directive"] ??
      report["violatedDirective"] ??
      report["effectiveDirective"] ??
      "unknown";
    const blocked_uri =
      report["blocked-uri"] ?? report["blockedURL"] ?? null;
    const document_uri =
      report["document-uri"] ?? report["documentURL"] ?? null;
    const source_file =
      report["source-file"] ?? report["sourceFile"] ?? null;
    const line_number =
      report["line-number"] ?? report["lineNumber"] ?? null;
    const status_code =
      report["status-code"] ?? report["statusCode"] ?? null;

    // Store in DB via service_role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("csp_reports").insert({
      violated_directive: String(violated_directive).slice(0, 500),
      blocked_uri: blocked_uri ? String(blocked_uri).slice(0, 1000) : null,
      document_uri: document_uri
        ? String(document_uri).slice(0, 1000)
        : null,
      source_file: source_file ? String(source_file).slice(0, 500) : null,
      line_number: typeof line_number === "number" ? line_number : null,
      status_code: typeof status_code === "number" ? status_code : null,
    });

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch {
    // Never fail loudly — CSP reporting should be silent
    return new Response(null, { status: 204, headers: corsHeaders });
  }
});
