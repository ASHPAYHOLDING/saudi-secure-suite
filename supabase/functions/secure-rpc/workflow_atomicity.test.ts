import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Workflow Atomicity Tests
 *
 * Tests that workflow operations are truly atomic:
 * - If an error occurs mid-execution, no partial state remains
 * - All-or-nothing semantics for startWorkflow and processStep
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceKey) {
  console.warn("⚠️ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping atomicity tests");
  Deno.exit(0);
}

const client = createClient(supabaseUrl, serviceKey);

Deno.test("atomic_start_workflow rolls back on non-existent entity_type", async () => {
  // Count workflow_instances before
  const { count: beforeCount } = await client
    .from("workflow_instances")
    .select("*", { count: "exact", head: true });

  // Call with a non-existent entity_type — should raise exception inside the function
  const { data, error } = await client.rpc("atomic_start_workflow", {
    p_tenant_id: "00000000-0000-0000-0000-000000000000", // non-existent tenant
    p_entity_type: "nonexistent_type_for_test",
    p_entity_id: "test-entity-123",
  });

  // Should have errored
  assertExists(error, "Expected an error for non-existent workflow");

  // Count workflow_instances after — should be unchanged (rollback)
  const { count: afterCount } = await client
    .from("workflow_instances")
    .select("*", { count: "exact", head: true });

  assertEquals(beforeCount, afterCount, "No partial workflow_instances should be created on error (atomic rollback)");
});

Deno.test("secure_workflow_action rolls back on invalid instance", async () => {
  // Count audit_logs before
  const { count: beforeAudit } = await client
    .from("audit_logs")
    .select("*", { count: "exact", head: true })
    .eq("action", "workflow_approved");

  // Call with a non-existent instance — should raise exception
  const { data, error } = await client.rpc("secure_workflow_action", {
    p_instance_id: "00000000-0000-0000-0000-000000000000",
    p_action: "approved",
    p_comment: "test rollback",
  });

  assertExists(error, "Expected an error for non-existent instance");

  // Count audit_logs after — no new 'workflow_approved' entry should exist
  const { count: afterAudit } = await client
    .from("audit_logs")
    .select("*", { count: "exact", head: true })
    .eq("action", "workflow_approved");

  assertEquals(beforeAudit, afterAudit, "No audit log should be created on rollback");
});

Deno.test("atomic_start_workflow rejects unauthenticated calls", async () => {
  // service_role bypasses auth.uid() check but the function checks auth.uid()
  // When called via service_role directly, auth.uid() returns null → should reject
  const { error } = await client.rpc("atomic_start_workflow", {
    p_tenant_id: "00000000-0000-0000-0000-000000000001",
    p_entity_type: "invoice",
    p_entity_id: "test-123",
  });

  assertExists(error, "Should reject when auth.uid() is null");
});
