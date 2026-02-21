import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Job handler registry
type JobHandler = (
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
) => Promise<Record<string, unknown> | void>;

const handlers: Record<string, JobHandler> = {
  "report:generate": async (payload, supabase) => {
    const { tenant_id, report_key, filters } = payload as any;
    // Simulate heavy report generation
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, grand_total, status")
      .eq("tenant_id", tenant_id)
      .limit(1000);
    return { rows: data?.length ?? 0, report_key };
  },

  "email:bulk": async (payload, _supabase) => {
    const { recipients, template } = payload as any;
    // Process bulk emails in batches
    const batchSize = 50;
    let sent = 0;
    const recipientList = recipients || [];
    for (let i = 0; i < recipientList.length; i += batchSize) {
      const batch = recipientList.slice(i, i + batchSize);
      // In production, call your email service here
      sent += batch.length;
    }
    return { sent, template };
  },

  "inventory:recalculate": async (payload, supabase) => {
    const { tenant_id, product_ids } = payload as any;
    // Recalculate stock for specified products
    let recalculated = 0;
    for (const productId of product_ids || []) {
      const { data: movements } = await supabase
        .from("stock_movements")
        .select("quantity, movement_type")
        .eq("tenant_id", tenant_id)
        .eq("product_id", productId);

      if (movements) {
        const balance = movements.reduce((sum: number, m: any) => {
          return m.movement_type === "in" ? sum + m.quantity : sum - m.quantity;
        }, 0);

        await supabase
          .from("products")
          .update({ current_stock: balance })
          .eq("id", productId);
        recalculated++;
      }
    }
    return { recalculated };
  },

  "pdf:generate": async (payload, _supabase) => {
    const { document_type, document_id } = payload as any;
    // Placeholder for server-side PDF generation
    return { document_type, document_id, status: "generated" };
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Requeue stale jobs first
    await supabase.rpc("requeue_stale_jobs");

    // Process up to 10 jobs per invocation
    let processed = 0;
    const maxJobs = 10;
    const results: Array<{ id: string; type: string; status: string }> = [];

    while (processed < maxJobs) {
      const { data: jobs, error } = await supabase.rpc("claim_next_job");

      if (error || !jobs || jobs.length === 0) break;

      const job = jobs[0];
      processed++;

      const handler = handlers[job.type];
      if (!handler) {
        await supabase.rpc("fail_job", {
          p_job_id: job.id,
          p_error: `Unknown job type: ${job.type}`,
        });
        results.push({ id: job.id, type: job.type, status: "unknown_type" });
        continue;
      }

      try {
        const result = await handler(job.payload, supabase);
        await supabase.rpc("complete_job", {
          p_job_id: job.id,
          p_result: result ?? null,
        });
        results.push({ id: job.id, type: job.type, status: "completed" });
      } catch (err: any) {
        await supabase.rpc("fail_job", {
          p_job_id: job.id,
          p_error: err.message?.slice(0, 500),
        });
        results.push({ id: job.id, type: job.type, status: "failed" });
      }
    }

    return new Response(
      JSON.stringify({ processed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
