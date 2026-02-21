/**
 * Workflow Engine — محرك سير العمل المؤسسي
 *
 * يدعم 3 أنواع خطوات:
 * - approval: تتطلب موافقة مستخدم بدور/صلاحية محددة
 * - condition: تمرر تلقائياً بناءً على شرط JSONB
 * - auto: تمرر تلقائياً دائماً (مثل إشعار أو تسجيل)
 *
 * الاستخدام:
 *   import { startWorkflow, processStep, getPendingApprovals } from "@/lib/workflows/engine";
 */

import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";

// ── Types ────────────────────────────────────────────────────────────────────

export type WfStepType = "approval" | "condition" | "auto";
export type WfInstanceStatus = "pending" | "in_progress" | "approved" | "rejected" | "cancelled";
export type WfStepStatus = "pending" | "approved" | "rejected" | "skipped" | "auto_passed";

export interface Workflow {
  id: string;
  tenant_id: string;
  name: string;
  name_en?: string;
  entity_type: string;
  is_active: boolean;
  description?: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  tenant_id: string;
  step_order: number;
  name: string;
  name_en?: string;
  type: WfStepType;
  role_required?: string;
  permission_required?: string;
  auto_condition?: Record<string, unknown>;
  is_required: boolean;
  timeout_hours?: number;
}

export interface WorkflowInstance {
  id: string;
  workflow_id: string;
  tenant_id: string;
  entity_id: string;
  entity_type: string;
  status: WfInstanceStatus;
  current_step_order: number;
  started_by: string;
}

export interface WorkflowInstanceStep {
  id: string;
  instance_id: string;
  step_id: string;
  tenant_id: string;
  step_order: number;
  status: WfStepStatus;
  acted_by?: string;
  acted_at?: string;
  comment?: string;
}

// ── Engine Functions ─────────────────────────────────────────────────────────

/**
 * startWorkflow — يبدأ سير عمل لكيان محدد
 */
export async function startWorkflow(
  tenantId: string,
  entityType: string,
  entityId: string,
  startedBy: string
): Promise<{ instanceId: string; status: WfInstanceStatus } | { error: string }> {
  // 1) البحث عن workflow مفعّل
  const { data: workflow, error: wfErr } = await (supabase as any)
    .from("workflows")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("entity_type", entityType)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (wfErr) return { error: wfErr.message };
  if (!workflow) return { error: `لا يوجد سير عمل مفعّل لنوع "${entityType}"` };

  // 2) جلب الخطوات مرتبة
  const { data: steps, error: stepsErr } = await (supabase as any)
    .from("workflow_steps")
    .select("id, step_order, name, type, role_required, permission_required, auto_condition, is_required")
    .eq("workflow_id", workflow.id)
    .order("step_order", { ascending: true });

  if (stepsErr) return { error: stepsErr.message };
  if (!steps || steps.length === 0) return { error: "سير العمل لا يحتوي على خطوات" };

  // 3) إنشاء instance
  const { data: instance, error: instErr } = await (supabase as any)
    .from("workflow_instances")
    .insert({
      workflow_id: workflow.id,
      tenant_id: tenantId,
      entity_id: entityId,
      entity_type: entityType,
      status: "in_progress",
      current_step_order: 1,
      started_by: startedBy,
    })
    .select("id")
    .single();

  if (instErr) return { error: instErr.message };

  // 4) إنشاء instance steps
  const instanceSteps = steps.map((s: WorkflowStep) => ({
    instance_id: instance.id,
    step_id: s.id,
    tenant_id: tenantId,
    step_order: s.step_order,
    status: "pending",
  }));

  const { error: isErr } = await (supabase as any)
    .from("workflow_instance_steps")
    .insert(instanceSteps);

  if (isErr) return { error: isErr.message };

  // 5) معالجة الخطوات التلقائية المتتالية من البداية
  const result = await advanceAutoSteps(instance.id, tenantId, steps);

  return { instanceId: instance.id, status: result.status };
}

/**
 * processStep — معالجة خطوة (موافقة/رفض) عبر secure-rpc
 *
 * ✅ Server-side enforcement:
 * - Tenant membership check
 * - RBAC (role_required / permission_required)
 * - Self-approval prevention
 * - Full audit logging
 */
export async function processStep(
  instanceId: string,
  _userId: string, // kept for API compat, server uses auth.uid()
  action: "approved" | "rejected",
  comment?: string
): Promise<{ status: WfInstanceStatus } | { error: string }> {
  const { data, error } = await secureRpc<{ status: WfInstanceStatus; step_order: number }>(
    "secure_workflow_action",
    {
      p_instance_id: instanceId,
      p_action: action,
      p_comment: comment || null,
    }
  );

  if (error) {
    return { error: error.message };
  }

  // After approval, advance auto steps if needed
  if (data?.status === "in_progress") {
    // Fetch all steps to advance auto ones
    const { data: inst } = await (supabase as any)
      .from("workflow_instances")
      .select("workflow_id, tenant_id")
      .eq("id", instanceId)
      .single();

    if (inst) {
      const { data: allSteps } = await (supabase as any)
        .from("workflow_steps")
        .select("id, step_order, type, auto_condition, is_required")
        .eq("workflow_id", inst.workflow_id)
        .order("step_order", { ascending: true });

      if (allSteps?.length) {
        const result = await advanceAutoSteps(instanceId, inst.tenant_id, allSteps);
        return { status: result.status };
      }
    }
  }

  return { status: data?.status || "in_progress" };
}

/**
 * getPendingApprovals — جلب الموافقات المعلقة لمستخدم محدد
 */
export async function getPendingApprovals(
  tenantId: string,
  _userId: string
): Promise<{ data: Array<WorkflowInstance & { step_name: string; entity_type: string }> } | { error: string }> {
  const { data: instances, error } = await (supabase as any)
    .from("workflow_instances")
    .select(`
      id, workflow_id, entity_id, entity_type, status, current_step_order, started_by, started_at,
      workflow_instance_steps!inner (
        id, step_id, step_order, status,
        workflow_steps:step_id ( name, name_en, type, role_required, permission_required )
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("status", "in_progress")
    .eq("workflow_instance_steps.status", "pending");

  if (error) return { error: error.message };

  const result = (instances || []).map((inst: any) => {
    const currentStepData = inst.workflow_instance_steps?.[0];
    const stepDef = currentStepData?.workflow_steps;
    return {
      ...inst,
      step_name: stepDef?.name || "—",
      workflow_instance_steps: undefined,
    };
  });

  return { data: result };
}

/**
 * cancelWorkflow — إلغاء مثيل سير عمل
 */
export async function cancelWorkflow(instanceId: string): Promise<{ success: boolean } | { error: string }> {
  const { error } = await (supabase as any)
    .from("workflow_instances")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
    })
    .eq("id", instanceId)
    .in("status", ["pending", "in_progress"]);

  if (error) return { error: error.message };
  return { success: true };
}

/**
 * getWorkflowHistory — سجل خطوات مثيل محدد
 */
export async function getWorkflowHistory(instanceId: string): Promise<WorkflowInstanceStep[] | { error: string }> {
  const { data, error } = await (supabase as any)
    .from("workflow_instance_steps")
    .select("id, instance_id, step_id, step_order, status, acted_by, acted_at, comment, created_at")
    .eq("instance_id", instanceId)
    .order("step_order", { ascending: true });

  if (error) return { error: error.message };
  return data || [];
}

// ── Internal ─────────────────────────────────────────────────────────────────

/**
 * advanceAutoSteps — يمرر الخطوات التلقائية (auto/condition) حتى يصل لخطوة approval
 */
async function advanceAutoSteps(
  instanceId: string,
  tenantId: string,
  allSteps: WorkflowStep[]
): Promise<{ status: WfInstanceStatus }> {
  const { data: inst } = await (supabase as any)
    .from("workflow_instances")
    .select("current_step_order")
    .eq("id", instanceId)
    .single();

  if (!inst) return { status: "in_progress" };

  let currentOrder = inst.current_step_order;

  while (true) {
    const step = allSteps.find((s) => s.step_order === currentOrder);
    if (!step) {
      await (supabase as any)
        .from("workflow_instances")
        .update({ status: "approved", completed_at: new Date().toISOString() })
        .eq("id", instanceId);
      return { status: "approved" };
    }

    if (step.type === "approval") {
      return { status: "in_progress" };
    }

    const stepStatus: WfStepStatus = step.type === "condition"
      ? evaluateCondition(step.auto_condition) ? "auto_passed" : "skipped"
      : "auto_passed";

    await (supabase as any)
      .from("workflow_instance_steps")
      .update({
        status: stepStatus,
        acted_at: new Date().toISOString(),
      })
      .eq("instance_id", instanceId)
      .eq("step_order", currentOrder);

    if (stepStatus === "skipped" && step.is_required) {
      await (supabase as any)
        .from("workflow_instances")
        .update({ status: "rejected", completed_at: new Date().toISOString() })
        .eq("id", instanceId);
      return { status: "rejected" };
    }

    currentOrder++;
    await (supabase as any)
      .from("workflow_instances")
      .update({ current_step_order: currentOrder })
      .eq("id", instanceId);
  }
}

/**
 * evaluateCondition — تقييم شرط JSONB بسيط
 */
function evaluateCondition(condition?: Record<string, unknown> | null): boolean {
  if (!condition) return true;
  return condition.pass === true;
}
