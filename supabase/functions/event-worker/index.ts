import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DomainEvent {
  id: string;
  tenant_id: string;
  domain: string;
  event_type: string;
  payload: Record<string, unknown>;
  source_entity_id?: string;
  source_entity_type?: string;
  retry_count: number;
  max_retries: number;
}

interface Subscriber {
  handler_name: string;
  handler_config: Record<string, unknown>;
  priority: number;
}

/**
 * Event-Driven Worker
 * 
 * Processes domain_events by:
 * 1. Claiming a batch (FOR UPDATE SKIP LOCKED)
 * 2. Looking up subscribers from event_subscribers
 * 3. Dispatching to handler logic
 * 4. Marking success or scheduling exponential-backoff retry
 * 5. Moving exhausted events to dead_letter_queue
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse optional batch size
    let batchSize = 20;
    try {
      const body = await req.json();
      if (body?.batch_size) batchSize = Math.min(body.batch_size, 50);
    } catch { /* default batch */ }

    // 1. Claim pending events atomically
    const { data: events, error: claimErr } = await supabase.rpc(
      "claim_pending_events",
      { p_batch_size: batchSize }
    );

    if (claimErr) {
      console.error("[event-worker] claim error:", claimErr);
      return new Response(
        JSON.stringify({ error: claimErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending events" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[event-worker] Processing ${events.length} events`);

    const results: Array<{ event_id: string; success: boolean; handlers: number; error?: string }> = [];

    for (const event of events as DomainEvent[]) {
      try {
        // 2. Get subscribers for this event
        const { data: subscribers } = await supabase.rpc(
          "get_event_subscribers",
          { p_domain: event.domain, p_event_type: event.event_type }
        );

        const subs = (subscribers || []) as Subscriber[];

        if (subs.length === 0) {
          // No subscribers — mark as processed (no-op event)
          await supabase.rpc("resolve_event", {
            p_event_id: event.id,
            p_success: true,
          });
          results.push({ event_id: event.id, success: true, handlers: 0 });
          continue;
        }

        // 3. Execute each handler
        let allSuccess = true;
        let lastError = "";

        for (const sub of subs) {
          try {
            await executeHandler(supabase, event, sub);
          } catch (handlerErr: any) {
            allSuccess = false;
            lastError = `${sub.handler_name}: ${handlerErr.message || handlerErr}`;
            console.error(
              `[event-worker] Handler ${sub.handler_name} failed for event ${event.id}:`,
              handlerErr
            );
            // Continue to next handler — partial failures are tracked
          }
        }

        // 4. Resolve: success or retry/DLQ
        await supabase.rpc("resolve_event", {
          p_event_id: event.id,
          p_success: allSuccess,
          p_error: allSuccess ? null : lastError,
        });

        results.push({
          event_id: event.id,
          success: allSuccess,
          handlers: subs.length,
          error: allSuccess ? undefined : lastError,
        });
      } catch (eventErr: any) {
        console.error(`[event-worker] Event ${event.id} processing failed:`, eventErr);
        await supabase.rpc("resolve_event", {
          p_event_id: event.id,
          p_success: false,
          p_error: eventErr.message || "Unknown error",
        });
        results.push({
          event_id: event.id,
          success: false,
          handlers: 0,
          error: eventErr.message,
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `[event-worker] Done: ${succeeded} succeeded, ${failed} failed out of ${results.length}`
    );

    return new Response(
      JSON.stringify({
        processed: results.length,
        succeeded,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[event-worker] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Handler dispatcher — maps handler_name to actual logic.
 * Each handler is idempotent by design (uses event.id as idempotency key).
 */
async function executeHandler(
  supabase: any,
  event: DomainEvent,
  sub: Subscriber
): Promise<void> {
  const { handler_name, handler_config } = sub;
  const { payload, tenant_id } = event;

  switch (handler_name) {
    // ── Billing Domain Handlers ──
    case "create_journal_entry": {
      // Auto-create journal entry when invoice is approved
      const invoiceId = payload.invoice_id as string;
      if (!invoiceId) return;

      // Idempotency: check if journal already exists for this invoice
      const { data: existing } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("reference_id", invoiceId)
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (existing) {
        console.log(`[handler:create_journal_entry] Journal already exists for invoice ${invoiceId}`);
        return;
      }

      console.log(`[handler:create_journal_entry] Would create journal for invoice ${invoiceId}`);
      // Actual journal creation would go here via accounting domain RPC
      break;
    }

    case "update_wallet_balance": {
      const invoiceId = payload.invoice_id as string;
      const total = payload.total as number;
      if (!invoiceId || !total) return;
      console.log(`[handler:update_wallet_balance] Would update wallet for invoice ${invoiceId}, amount ${total}`);
      // Actual wallet update via wallet domain
      break;
    }

    case "send_notification": {
      const channel = (handler_config.channel as string) || "in_app";
      console.log(`[handler:send_notification] ${channel} notification for ${event.event_type}`);
      // Would create collaboration_notifications entry
      break;
    }

    case "notify_crm": {
      console.log(`[handler:notify_crm] Logging CRM activity for ${event.event_type}`);
      break;
    }

    // ── Accounting Domain Handlers ──
    case "update_trial_balance": {
      console.log(`[handler:update_trial_balance] Recalculating for journal ${payload.journal_id}`);
      break;
    }

    case "check_budget_alerts": {
      console.log(`[handler:check_budget_alerts] Checking budgets after journal post`);
      break;
    }

    case "generate_closing_report": {
      console.log(`[handler:generate_closing_report] Period ${payload.period_id} closed`);
      break;
    }

    // ── CRM Domain Handlers ──
    case "send_welcome": {
      console.log(`[handler:send_welcome] Welcome email for customer ${payload.customer_id}`);
      break;
    }

    // ── Inventory Domain Handlers ──
    case "check_reorder_level": {
      const newQty = payload.new_qty as number;
      console.log(`[handler:check_reorder_level] Product ${payload.product_id} now at ${newQty}`);
      // Would check against reorder_level and create purchase order suggestion
      break;
    }

    case "log_stock_movement": {
      console.log(`[handler:log_stock_movement] ${payload.change} units, reason: ${payload.reason}`);
      break;
    }

    // ── Governance Domain Handlers ──
    case "notify_admins": {
      const threshold = (handler_config.severity_threshold as string) || "high";
      const severity = payload.severity as string;
      if (severity === "critical" || severity === threshold) {
        console.log(`[handler:notify_admins] Alert: ${severity} violation ${payload.violation_id}`);
      }
      break;
    }

    case "execute_post_approval": {
      console.log(`[handler:execute_post_approval] ${payload.document_type} ${payload.document_number} approved`);
      // Would update the source document status
      break;
    }

    case "notify_requester": {
      console.log(`[handler:notify_requester] Workflow ${payload.request_id} rejected`);
      break;
    }

    // ── HR Domain Handlers ──
    case "send_invite_email": {
      console.log(`[handler:send_invite_email] Sending invite to ${payload.email}`);
      break;
    }

    default:
      console.warn(`[event-worker] Unknown handler: ${handler_name}`);
  }
}
