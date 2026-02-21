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
 *
 * 1. يبحث عن workflow مفعّل لنوع الكيان في المنشأة
 * 2. ينشئ instance جديد
 * 3. ينشئ instance_steps لكل خطوة بالترتيب
 * 4. يعالج الخطوات التلقائية الأولى إن وجدت
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
 * processStep — معالجة خطوة (موافقة/رفض)
 *
 * يُستخدم فقط لخطوات من نوع approval
 */
export async function processStep(
  instanceId: string,
  userId: string,
  action: "approved" | "rejected",
  comment?: string
): Promise<{ status: WfInstanceStatus } | { error: string }> {
  // 1) جلب الـ instance الحالي
  const { data: instance, error: instErr } = await (supabase as any)
    .from("workflow_instances")
    .select("id, tenant_id, workflow_id, current_step_order, status")
    .eq("id", instanceId)
    .single();

  if (instErr || !instance) return { error: instErr?.message || "المثيل غير موجود" };
  if (instance.status !== "in_progress") return { error: `المثيل بحالة "${instance.status}" ولا يمكن التعديل عليه` };

  // 2) جلب خطوة الـ instance الحالية
  const { data: currentStep, error: csErr } = await (supabase as any)
    .from("workflow_instance_steps")
    .select("id, step_id, step_order, status")
    .eq("instance_id", instanceId)
    .eq("step_order", instance.current_step_order)
    .single();

  if (csErr || !currentStep) return { error: "لم يتم العثور على الخطوة الحالية" };
  if (currentStep.status !== "pending") return { error: "الخطوة ليست في حالة انتظار" };

  // 3) تحديث الخطوة
  const { error: updateErr } = await (supabase as any)
    .from("workflow_instance_steps")
    .update({
      status: action,
      acted_by: userId,
      acted_at: new Date().toISOString(),
      comment: comment || null,
    })
    .eq("id", currentStep.id);

  if (updateErr) return { error: updateErr.message };

  // 4) إذا رُفضت → إنهاء المثيل
  if (action === "rejected") {
    await (supabase as any)
      .from("workflow_instances")
      .update({
        status: "rejected",
        completed_at: new Date().toISOString(),
      })
      .eq("id", instanceId);

    return { status: "rejected" };
  }

  // 5) إذا وُوفق عليها → التقدم للخطوة التالية
  const { data: allSteps } = await (supabase as any)
    .from("workflow_steps")
    .select("id, step_order, type, auto_condition, is_required")
    .eq("workflow_id", instance.workflow_id)
    .order("step_order", { ascending: true });

  const nextOrder = instance.current_step_order + 1;
  const hasMore = allSteps?.some((s: WorkflowStep) => s.step_order >= nextOrder);

  if (!hasMore) {
    // آخر خطوة — إتمام المثيل
    await (supabase as any)
      .from("workflow_instances")
      .update({
        status: "approved",
        completed_at: new Date().toISOString(),
      })
      .eq("id", instanceId);

    return { status: "approved" };
  }

  // تقديم للخطوة التالية
  await (supabase as any)
    .from("workflow_instances")
    .update({ current_step_order: nextOrder })
    .eq("id", instanceId);

  // معالجة الخطوات التلقائية المتتالية
  const result = await advanceAutoSteps(instanceId, instance.tenant_id, allSteps || []);
  return { status: result.status };
}

/**
 * getPendingApprovals — جلب الموافقات المعلقة لمستخدم محدد
 */
export async function getPendingApprovals(
  tenantId: string,
  _userId: string
): Promise<{ data: Array<WorkflowInstance & { step_name: string; entity_type: string }> } | { error: string }> {
  // جلب المثيلات النشطة مع الخطوة الحالية
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

  // تحويل لشكل مبسّط
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
  // جلب الـ instance الحالي
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
      // لا يوجد خطوات أخرى — إتمام
      await (supabase as any)
        .from("workflow_instances")
        .update({ status: "approved", completed_at: new Date().toISOString() })
        .eq("id", instanceId);
      return { status: "approved" };
    }

    if (step.type === "approval") {
      // خطوة تتطلب تدخل بشري — توقف
      return { status: "in_progress" };
    }

    // auto أو condition → تمرير تلقائي
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

    // إذا الشرط فشل والخطوة إلزامية → رفض
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
 * TODO: توسيع لدعم مقارنات أعقد (amount > X, etc.)
 */
function evaluateCondition(condition?: Record<string, unknown> | null): boolean {
  if (!condition) return true;
  // حالياً: إذا وُجد شرط بقيمة pass=true يمرر
  return condition.pass === true;
}
