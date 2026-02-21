import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, GitBranch, CheckCircle2, XCircle, Clock, ArrowUpDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { RuleBuilder, type WorkflowRules, rulesToJson, jsonToRules } from "./RuleBuilder";

const DOCUMENT_TYPES = [
  { value: "invoice", labelAr: "فاتورة", labelEn: "Invoice" },
  { value: "expense", labelAr: "مصروف", labelEn: "Expense" },
  { value: "purchase_order", labelAr: "أمر شراء", labelEn: "Purchase Order" },
  { value: "contract", labelAr: "عقد", labelEn: "Contract" },
  { value: "discount", labelAr: "خصم", labelEn: "Discount" },
];

const APPROVER_ROLES = [
  { value: "owner", labelAr: "مالك", labelEn: "Owner" },
  { value: "admin", labelAr: "مدير", labelEn: "Admin" },
  { value: "manager", labelAr: "مدير قسم", labelEn: "Manager" },
  { value: "accountant", labelAr: "محاسب", labelEn: "Accountant" },
];

interface WorkflowStep {
  step_order: number;
  approver_type: string;
  approver_role: string;
  step_name: string;
  step_name_en: string;
}

const ApprovalWorkflowsPage = () => {
  const { user, tenantId } = useAuth();
  const { t, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState("workflows");

  // Form state
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [docType, setDocType] = useState("invoice");
  const [rules, setRules] = useState<WorkflowRules>({ conditions: [], logic: "AND" });
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { step_order: 1, approver_type: "role", approver_role: "manager", step_name: "موافقة المدير", step_name_en: "Manager Approval" },
  ]);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["approval-workflows", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_workflows")
        .select("*, approval_workflow_steps(*)")
        .eq("tenant_id", tenantId!)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: approvalRequests = [] } = useQuery({
    queryKey: ["approval-requests", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("*, approval_actions(*), approval_workflows(name, name_en)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const createWorkflow = useMutation({
    mutationFn: async () => {
      const rulesJson = rulesToJson(rules);
      // Derive legacy fields for backward compat
      const amountConditions = rules.conditions.filter(c => c.field === "amount");
      let minAmount = 0;
      let maxAmount: number | null = null;
      let conditionType = "always";
      if (amountConditions.length > 0) {
        conditionType = "amount";
        for (const c of amountConditions) {
          const val = parseFloat(c.value) || 0;
          if (c.operator === ">" || c.operator === ">=") minAmount = val;
          if (c.operator === "<" || c.operator === "<=") maxAmount = val;
        }
      }

      const { data: wf, error: wfErr } = await supabase
        .from("approval_workflows")
        .insert({
          tenant_id: tenantId!,
          name,
          name_en: nameEn || null,
          document_type: docType,
          condition_type: conditionType,
          min_amount: minAmount,
          max_amount: maxAmount,
          rules_json: rulesJson as any,
          created_by: user!.id,
          priority: workflows.length,
        })
        .select()
        .single();
      if (wfErr) throw wfErr;

      // Create steps
      const stepInserts = steps.map((s) => ({
        workflow_id: wf.id,
        tenant_id: tenantId!,
        step_order: s.step_order,
        approver_type: s.approver_type,
        approver_role: s.approver_role,
        step_name: s.step_name,
        step_name_en: s.step_name_en || null,
      }));
      const { error: stErr } = await supabase.from("approval_workflow_steps").insert(stepInserts);
      if (stErr) throw stErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-workflows"] });
      toast.success(isRTL ? "تم إنشاء سلسلة الموافقات بنجاح" : "Approval workflow created successfully");
      resetForm();
      setShowCreate(false);
    },
    onError: () => toast.error(isRTL ? "فشل الإنشاء" : "Failed to create workflow"),
  });

  const toggleWorkflow = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("approval_workflows").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approval-workflows"] }),
  });

  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("approval_workflows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-workflows"] });
      toast.success(isRTL ? "تم الحذف" : "Deleted");
    },
  });

  const processApproval = useMutation({
    mutationFn: async ({ actionId, requestId, decision, comment }: { actionId: string; requestId: string; decision: "approved" | "rejected"; comment?: string }) => {
      const { data, error } = await secureRpc("secure_approval_action", {
        p_action_id: actionId,
        p_request_id: requestId,
        p_decision: decision,
        p_comment: comment || null,
      });

      if (error) throw new Error(error.message);

      const { data: request } = await supabase.from("approval_requests").select("*").eq("id", requestId).single();
      if (request) {
        const finalStatus = data?.status || decision;
        const docLabel = DOCUMENT_TYPES.find(d => d.value === request.document_type);
        const notifMessage = decision === "approved"
          ? `تمت الموافقة على ${docLabel?.labelAr || request.document_type} ${request.document_number || ""} - المستوى ${request.current_step}`
          : `تم رفض ${docLabel?.labelAr || request.document_type} ${request.document_number || ""}`;

        await supabase.from("collaboration_notifications").insert({
          tenant_id: tenantId!,
          user_id: request.requested_by,
          actor_id: user!.id,
          type: "approval_decision",
          entity_type: "approval_request",
          entity_id: requestId,
          message: notifMessage,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-requests"] });
      toast.success(isRTL ? "تم تسجيل القرار" : "Decision recorded");
    },
  });

  const resetForm = () => {
    setName("");
    setNameEn("");
    setDocType("invoice");
    setRules({ conditions: [], logic: "AND" });
    setSteps([{ step_order: 1, approver_type: "role", approver_role: "manager", step_name: "موافقة المدير", step_name_en: "Manager Approval" }]);
  };

  const addStep = () => {
    setSteps([...steps, {
      step_order: steps.length + 1,
      approver_type: "role",
      approver_role: "admin",
      step_name: `المستوى ${steps.length + 1}`,
      step_name_en: `Level ${steps.length + 1}`,
    }]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const newSteps = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 }));
    setSteps(newSteps);
  };

  const updateStep = (index: number, field: keyof WorkflowStep, value: string | number) => {
    const newSteps = [...steps];
    (newSteps[index] as any)[field] = value;
    setSteps(newSteps);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      pending: { color: "bg-warning/10 text-warning", label: isRTL ? "قيد الانتظار" : "Pending" },
      approved: { color: "bg-success/10 text-success", label: isRTL ? "معتمد" : "Approved" },
      rejected: { color: "bg-destructive/10 text-destructive", label: isRTL ? "مرفوض" : "Rejected" },
      cancelled: { color: "bg-muted text-muted-foreground", label: isRTL ? "ملغي" : "Cancelled" },
    };
    const s = map[status] || map.pending;
    return <Badge className={cn("font-medium", s.color)}>{s.label}</Badge>;
  };

  const getDocLabel = (type: string) => {
    const d = DOCUMENT_TYPES.find((dt) => dt.value === type);
    return d ? (isRTL ? d.labelAr : d.labelEn) : type;
  };

  const renderRulesSummary = (wf: any) => {
    const wfRules = jsonToRules(wf.rules_json);
    if (wfRules.conditions.length === 0) {
      // Legacy display
      if (wf.condition_type === "amount") {
        return (
          <Badge variant="secondary" className="text-xs">
            {wf.min_amount?.toLocaleString()} - {wf.max_amount ? wf.max_amount.toLocaleString() : "∞"} {isRTL ? "ر.س" : "SAR"}
          </Badge>
        );
      }
      return null;
    }
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <Filter className="w-3 h-3" />
        {wfRules.conditions.length} {isRTL ? "شرط" : "rules"} ({wfRules.logic})
      </Badge>
    );
  };

  const pendingRequests = approvalRequests.filter((r: any) => r.status === "pending");

  return (
    <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isRTL ? "تسلسل الموافقات" : "Approval Workflows"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isRTL ? "إدارة قواعد الموافقات متعددة المستويات للمستندات المالية" : "Manage multi-level approval rules for financial documents"}
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 me-2" />{isRTL ? "إضافة سلسلة" : "Add Workflow"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isRTL ? "إنشاء سلسلة موافقات جديدة" : "Create New Approval Workflow"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isRTL ? "مثال: موافقة فواتير كبيرة" : "e.g. Large invoice approval"} />
                </div>
                <div>
                  <Label>{isRTL ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                  <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Optional" />
                </div>
              </div>

              <div>
                <Label>{isRTL ? "نوع المستند" : "Document Type"}</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>{isRTL ? dt.labelAr : dt.labelEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rule Builder */}
              <RuleBuilder rules={rules} onChange={setRules} />

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">{isRTL ? "مستويات الموافقة" : "Approval Levels"}</Label>
                  <Button variant="outline" size="sm" onClick={addStep}>
                    <Plus className="h-3 w-3 me-1" />{isRTL ? "إضافة مستوى" : "Add Level"}
                  </Button>
                </div>
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          {isRTL ? `المستوى ${step.step_order}` : `Level ${step.step_order}`}
                        </span>
                        {steps.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeStep(i)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">{isRTL ? "اسم الخطوة" : "Step Name"}</Label>
                          <Input value={step.step_name} onChange={(e) => updateStep(i, "step_name", e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">{isRTL ? "الاسم بالإنجليزي" : "Name (EN)"}</Label>
                          <Input value={step.step_name_en} onChange={(e) => updateStep(i, "step_name_en", e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">{isRTL ? "الدور المعتمد" : "Approver Role"}</Label>
                          <Select value={step.approver_role} onValueChange={(v) => updateStep(i, "approver_role", v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {APPROVER_ROLES.map((r) => (
                                <SelectItem key={r.value} value={r.value}>{isRTL ? r.labelAr : r.labelEn}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={() => createWorkflow.mutate()} disabled={!name || createWorkflow.isPending} className="w-full">
                {createWorkflow.isPending ? (isRTL ? "جاري الإنشاء..." : "Creating...") : (isRTL ? "إنشاء السلسلة" : "Create Workflow")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><GitBranch className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{workflows.length}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "سلسلة موافقات" : "Workflows"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-2xl font-bold">{pendingRequests.length}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "بانتظار الموافقة" : "Pending"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><CheckCircle2 className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-2xl font-bold">{approvalRequests.filter((r: any) => r.status === "approved").length}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "معتمدة" : "Approved"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><XCircle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{approvalRequests.filter((r: any) => r.status === "rejected").length}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "مرفوضة" : "Rejected"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="workflows">{isRTL ? "سلاسل الموافقات" : "Workflows"}</TabsTrigger>
          <TabsTrigger value="requests">
            {isRTL ? "طلبات الموافقة" : "Approval Requests"}
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ms-2 h-5 px-1.5 text-[10px]">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4 mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
          ) : workflows.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">{isRTL ? "لا توجد سلاسل موافقات. أنشئ أول سلسلة!" : "No workflows yet. Create your first one!"}</p>
              </CardContent>
            </Card>
          ) : (
            workflows.map((wf: any) => (
              <Card key={wf.id} className={cn(!wf.is_active && "opacity-60")}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle className="text-base">{isRTL ? wf.name : (wf.name_en || wf.name)}</CardTitle>
                      <Badge variant="outline">{getDocLabel(wf.document_type)}</Badge>
                      {renderRulesSummary(wf)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={wf.is_active} onCheckedChange={(v) => toggleWorkflow.mutate({ id: wf.id, is_active: v })} />
                      <Button variant="ghost" size="sm" onClick={() => deleteWorkflow.mutate(wf.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Show rules detail if present */}
                  {(() => {
                    const wfRules = jsonToRules(wf.rules_json);
                    if (wfRules.conditions.length === 0) return null;
                    return (
                      <div className="mb-3 flex items-center gap-2 flex-wrap">
                        {wfRules.conditions.map((c, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] gap-1 font-mono">
                            {c.field} {c.operator} {c.value}
                            {i < wfRules.conditions.length - 1 && (
                              <span className="text-primary font-bold ms-1">{wfRules.logic}</span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-2 flex-wrap">
                    {(wf.approval_workflow_steps || [])
                      .sort((a: any, b: any) => a.step_order - b.step_order)
                      .map((step: any, i: number, arr: any[]) => (
                        <div key={step.id} className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-full">
                            <span className="text-xs font-bold text-primary">{step.step_order}</span>
                            <span className="text-xs">{isRTL ? step.step_name : (step.step_name_en || step.step_name)}</span>
                            <Badge variant="outline" className="text-[10px] h-4">{APPROVER_ROLES.find(r => r.value === step.approver_role)?.[isRTL ? "labelAr" : "labelEn"] || step.approver_role}</Badge>
                          </div>
                          {i < arr.length - 1 && <ArrowUpDown className="h-3 w-3 text-muted-foreground rotate-90" />}
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4 mt-4">
          {approvalRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">{isRTL ? "لا توجد طلبات موافقة" : "No approval requests"}</p>
              </CardContent>
            </Card>
          ) : (
            approvalRequests.map((req: any) => (
              <Card key={req.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{getDocLabel(req.document_type)}</Badge>
                      <span className="text-sm font-medium">{req.document_number || req.document_id?.slice(0, 8)}</span>
                      {getStatusBadge(req.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isRTL ? "المبلغ:" : "Amount:"} {req.document_amount?.toLocaleString()} {isRTL ? "ر.س" : "SAR"}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: req.total_steps }, (_, i) => {
                      const stepNum = i + 1;
                      const action = (req.approval_actions || []).find((a: any) => a.step_order === stepNum);
                      const color = action?.action === "approved" ? "bg-success" : action?.action === "rejected" ? "bg-destructive" : stepNum === req.current_step && req.status === "pending" ? "bg-warning animate-pulse" : "bg-muted";
                      return <div key={i} className={cn("h-2 flex-1 rounded-full transition-colors", color)} />;
                    })}
                  </div>

                  {/* Actions for pending step */}
                  {req.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex-1">
                        {isRTL ? `المستوى ${req.current_step} من ${req.total_steps}` : `Step ${req.current_step} of ${req.total_steps}`}
                      </span>
                      {(req.approval_actions || [])
                        .filter((a: any) => a.step_order === req.current_step && a.action === "pending")
                        .map((a: any) => (
                          <div key={a.id} className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10"
                              onClick={() => processApproval.mutate({ actionId: a.id, requestId: req.id, decision: "approved" })}>
                              <CheckCircle2 className="h-3 w-3 me-1" />{isRTL ? "موافقة" : "Approve"}
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => processApproval.mutate({ actionId: a.id, requestId: req.id, decision: "rejected" })}>
                              <XCircle className="h-3 w-3 me-1" />{isRTL ? "رفض" : "Reject"}
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApprovalWorkflowsPage;
