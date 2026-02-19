import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Optional: process a specific tenant immediately (called inline after upgrade)
    let specificTenantId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        specificTenantId = body.tenant_id || null;
      } catch {
        // no body = process queue
      }
    }

    if (specificTenantId) {
      // Immediate rebuild for a single tenant
      const { error } = await supabase.rpc("rebuild_tenant_entitlements_cache", {
        p_tenant_id: specificTenantId,
      });
      if (error) {
        console.error("Rebuild failed for tenant:", specificTenantId, error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, rebuilt: [specificTenantId] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process queue: up to 20 pending entries
    const { data: queue, error: qErr } = await supabase
      .from("entitlements_rebuild_queue")
      .select("id, tenant_id, reason")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(20);

    if (qErr) {
      console.error("Queue read error:", qErr);
      return new Response(JSON.stringify({ error: qErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!queue || queue.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rebuilt: string[] = [];
    const failed: string[] = [];

    for (const item of queue) {
      const { error: rebuildErr } = await supabase.rpc("rebuild_tenant_entitlements_cache", {
        p_tenant_id: item.tenant_id,
      });

      if (rebuildErr) {
        console.error(`Rebuild failed for ${item.tenant_id}:`, rebuildErr);
        failed.push(item.tenant_id);
        continue;
      }

      // Mark as processed
      await supabase
        .from("entitlements_rebuild_queue")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", item.id);

      rebuilt.push(item.tenant_id);
    }

    console.log(`Entitlements worker: rebuilt=${rebuilt.length}, failed=${failed.length}`);

    return new Response(
      JSON.stringify({ ok: true, processed: rebuilt.length, failed: failed.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Entitlements worker error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
