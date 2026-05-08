/**
 * Tenant Isolation Test Suite
 *
 * Verifies that:
 *  1. Every public table containing `tenant_id` has RLS enabled AND ≥1 policy
 *     (including auto-created monthly partitions: audit_logs_*, webhook_events_*,
 *     production_metrics_*).
 *  2. Anonymous (unauthenticated) clients cannot read rows from current/next
 *     month partitions of those tables.
 *  3. Anonymous clients cannot read core tenant tables.
 *
 * Run:
 *   deno test --allow-net --allow-env supabase/functions/tenant-isolation-tests/
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function monthKey(offset: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `y${y}m${m}`;
}

const PARTITION_BASES = ["audit_logs", "webhook_events", "production_metrics"];
const CURRENT_PARTITIONS = [0, 1].flatMap((off) =>
  PARTITION_BASES.map((b) => `${b}_${monthKey(off)}`),
);

// Common test options — disables Deno leak detection for realtime ws timers.
const opts = { sanitizeOps: false, sanitizeResources: false };

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — Structural: no tenant_id table without RLS + policies
// ─────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: "ISO-1: every tenant_id table has RLS enabled + at least one policy",
  ...opts,
  async fn() {
    if (!SERVICE_ROLE_KEY) {
      console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY not set — skipping structural audit");
      return;
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data, error } = await admin.rpc("audit_tenant_isolation");
    assertEquals(error, null, `RPC error: ${error?.message}`);
    const offenders =
      (data as Array<{ table: string; rls_enabled: boolean; policy_count: number }>) ?? [];
    if (offenders.length > 0) {
      console.error("❌ Tables breaking tenant isolation:", JSON.stringify(offenders, null, 2));
    }
    assertEquals(
      offenders.length,
      0,
      `Found ${offenders.length} table(s) with tenant_id but missing RLS or policies`,
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Runtime: anon cannot read current/next month partitions
// ─────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: "ISO-2: anon client cannot read any row from current monthly partitions",
  ...opts,
  async fn() {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    for (const table of CURRENT_PARTITIONS) {
      const { data, error } = await anon.from(table).select("*").limit(5);
      const rowCount = Array.isArray(data) ? data.length : 0;
      assertEquals(
        rowCount,
        0,
        `❌ Tenant leak: anon read ${rowCount} row(s) from ${table}. Error: ${error?.message ?? "none"}`,
      );
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Runtime: anon cannot read core tenant tables (sanity)
// ─────────────────────────────────────────────────────────────────────────────
Deno.test({
  name: "ISO-3: anon client cannot read core tenant tables",
  ...opts,
  async fn() {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const coreTables = [
      "customers",
      "invoices",
      "wallet_transactions",
      "chart_of_accounts",
      "branches",
      "approval_requests",
    ];
    for (const table of coreTables) {
      const { data } = await anon.from(table).select("*").limit(1);
      const rowCount = Array.isArray(data) ? data.length : 0;
      assert(rowCount === 0, `❌ Tenant leak: anon read ${rowCount} row(s) from ${table}`);
    }
  },
});
