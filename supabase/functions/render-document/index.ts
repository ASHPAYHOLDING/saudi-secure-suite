import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RenderRequest {
  template_id?: string;
  document_type: string;
  document_id?: string;
  document_number?: string;
  variables: Record<string, string>;
  action?: "render_html" | "log_render";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for auth check
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for DB operations
    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Get user tenant
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RenderRequest = await req.json();
    const startTime = Date.now();

    // Fetch template
    let htmlTemplate = "";
    let cssTemplate = "";

    if (body.template_id) {
      const { data: template, error: tErr } = await adminClient
        .from("document_templates")
        .select("html_template, css, document_type")
        .eq("id", body.template_id)
        .eq("tenant_id", profile.tenant_id)
        .single();

      if (tErr || !template) {
        return new Response(JSON.stringify({ error: "Template not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      htmlTemplate = template.html_template;
      cssTemplate = template.css;
    } else if (body.document_type) {
      // Fetch default template for this type
      const { data: template } = await adminClient
        .from("document_templates")
        .select("html_template, css")
        .eq("tenant_id", profile.tenant_id)
        .eq("document_type", body.document_type)
        .eq("is_default", true)
        .eq("is_active", true)
        .single();

      if (template) {
        htmlTemplate = template.html_template;
        cssTemplate = template.css;
      } else {
        return new Response(JSON.stringify({ error: "No default template found for this type" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Replace variables in template
    let renderedHtml = htmlTemplate;
    if (body.variables) {
      for (const [key, value] of Object.entries(body.variables)) {
        const placeholder = key.startsWith("{{") ? key : `{{${key}}}`;
        renderedHtml = renderedHtml.split(placeholder).join(value || "");
      }
    }

    // Build full HTML document
    const fullHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { direction: rtl; }
body { font-family: 'IBM Plex Sans Arabic', sans-serif; direction: rtl; color: #1a1a2e; background: white; line-height: 1.7; font-size: 13px; }
@page { size: A4; margin: 12mm 15mm; }
@media print { html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
.font-english, [dir="ltr"], .num { font-family: 'Inter', sans-serif; direction: ltr; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: right; padding: 10px 14px; font-size: 12px; }
${cssTemplate}
</style>
</head>
<body>${renderedHtml}</body>
</html>`;

    const renderDuration = Date.now() - startTime;

    // Log the render
    await adminClient.from("document_render_logs").insert({
      tenant_id: profile.tenant_id,
      template_id: body.template_id || null,
      document_type: body.document_type,
      document_id: body.document_id || null,
      document_number: body.document_number || null,
      rendered_by: user.id,
      render_format: "html",
      render_duration_ms: renderDuration,
      file_size_bytes: new TextEncoder().encode(fullHtml).length,
      status: "success",
    });

    return new Response(JSON.stringify({ html: fullHtml, render_duration_ms: renderDuration }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("render-document error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
