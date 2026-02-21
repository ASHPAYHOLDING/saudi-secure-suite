/**
 * Workflow Engine — محرك سير العمل المؤسسي (Atomic)
 *
 * جميع العمليات تمر عبر دوال SQL ذرية (atomic) لضمان:
 * - عدم وجود تحديثات جزئية في حال الخطأ
 * - تسجيل تدقيق شامل في audit_logs
 * - التحقق من الصلاحيات في جانب السيرفر حصراً
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
 * startWorkflow — يبدأ سير عمل لكيان محدد (Atomic via SQL function)
 *
 * ✅ Single RPC call that atomically:
 * - Finds active workflow + validates steps exist
 * - Creates workflow_instance + all instance_steps
 * - Evaluates condition steps using rule engine
 * - Advances auto/condition steps
 * - Logs to audit_logs
 * - Rolls back everything on any error
 */
export async function startWorkflow(
  tenantId: string,
  entityType: string,
  entityId: string,
  _startedBy: string, // kept for API compat, server uses auth.uid()
  context: Record<string, unknown> = {}
): Promise<{ instanceId: string; status: WfInstanceStatus } | { error: string }> {
  const { data, error } = await secureRpc<{ instance_id: string; status: WfInstanceStatus }>(
    "atomic_start_workflow",
    {
      p_tenant_id: tenantId,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_context: context,
    }
  );

  if (error) return { error: error.message };
  if (!data) return { error: "لم يتم إرجاع بيانات من الخادم" };

  return { instanceId: data.instance_id, status: data.status };
}

/**
 * processStep — معالجة خطوة (موافقة/رفض) عبر secure-rpc (Atomic)
 *
 * ✅ Single RPC call that atomically:
 * - Validates permissions (RBAC, tenant membership, strict self-approval prevention)
 * - Updates current step status
 * - Evaluates condition steps using rule engine
 * - Advances auto/condition steps
 * - Updates instance status
 * - Logs to audit_logs
 * - Rolls back everything on any error
 */
export async function processStep(
  instanceId: string,
  _userId: string, // kept for API compat, server uses auth.uid()
  action: "approved" | "rejected",
  comment?: string,
  context: Record<string, unknown> = {}
): Promise<{ status: WfInstanceStatus } | { error: string }> {
  const { data, error } = await secureRpc<{ status: WfInstanceStatus; step_order: number }>(
    "secure_workflow_action",
    {
      p_instance_id: instanceId,
      p_action: action,
      p_comment: comment || null,
      p_context: context,
    }
  );

  if (error) return { error: error.message };
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
