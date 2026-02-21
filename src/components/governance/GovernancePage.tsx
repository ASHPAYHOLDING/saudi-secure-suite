/**
 * GovernancePage — /dashboard/governance
 * Enterprise governance & compliance management dashboard.
 */
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, AlertTriangle, Plus, CheckCircle2, XCircle, Eye, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

type PolicyType = "approval_limit" | "segregation_of_duties" | "transaction_limit" | "restricted_access";

const POLICY_TYPE_LABELS: Record<PolicyType, { ar: string; en: string; icon: string }> = {
  approval_limit: { ar: "حد الاعتماد المالي", en: "Approval Limit", icon: "💰" },
  segregation_of_duties: { ar: "فصل المهام", en: "Segregation of Duties", icon: "🔀" },
  transaction_limit: { ar: "حد المعاملات اليومي", en: "Transaction Limit", icon: "📊" },
  restricted_access: { ar: "تقييد الوصول", en: "Restricted Access", icon: "🔒" },
};

const ENTITY_TYPES = [
  { value: "invoice", ar: "فاتورة", en: "Invoice" },
  { value: "payment", ar: "دفعة", en: "Payment" },
  { value: "journal_entry", ar: "قيد يومية", en: "Journal Entry" },
  { value: "expense", ar: "مصروف", en: "Expense" },
  { value: "contract", ar: "عقد", en: "Contract" },
  { value: "approval", ar: "موافقة", en: "Approval" },
];

/* ─── Policy Creation Form ─────────────────────── */
function PolicyForm({ onClose }: { onClose: () => void }) {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const [policyType, setPolicyType] = useState<PolicyType>("approval_limit");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState("invoice");

  // Config fields based on type
  const [maxAmountDefault, setMaxAmountDefault] = useState("");
  const [maxAmountAdmin, setMaxAmountAdmin] = useState("");
  const [maxPerDay, setMaxPerDay] = useState("");
  const [conflictingAction, setConflictingAction] = useState("");
  const [blockedRoles, setBlockedRoles] = useState("");
  const [blockedAction, setBlockedAction] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id) throw new Error("Not authenticated");
      if (!name.trim()) throw new Error("Name required");

      let config: Record<string, any> = { applies_to_entity: entityType };

      switch (policyType) {
        case "approval_limit":
          config.max_amount_default = parseFloat(maxAmountDefault) || 50000;
          if (maxAmountAdmin) config.max_amount_admin = parseFloat(maxAmountAdmin);
          break;
        case "transaction_limit":
          config.max_per_day = parseInt(maxPerDay) || 100;
          break;
        case "segregation_of_duties":
          config.entity_type = entityType;
          config.conflicting_action = conflictingAction || "approve";
          break;
        case "restricted_access":
          config.blocked_roles = blockedRoles.split(",").map(r => r.trim()).filter(Boolean);
          if (blockedAction) config.blocked_action = blockedAction;
          break;
      }

      const { error } = await supabase.from("governance_policies").insert({
        tenant_id: tenantId,
        policy_type: policyType,
        name: name.trim(),
        name_en: nameEn.trim() || null,
        description: description.trim() || null,
        config,
        created_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isRTL ? "تم إنشاء السياسة بنجاح" : "Policy created successfully");
      queryClient.invalidateQueries({ queryKey: ["governance-policies"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{isRTL ? "اسم السياسة (عربي)" : "Policy Name (Arabic)"}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isRTL ? "حد اعتماد الفواتير" : "Invoice approval limit"} />
        </div>
        <div>
          <Label>{isRTL ? "اسم السياسة (إنجليزي)" : "Policy Name (English)"}</Label>
          <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>{isRTL ? "نوع السياسة" : "Policy Type"}</Label>
        <Select value={policyType} onValueChange={(v) => setPolicyType(v as PolicyType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(POLICY_TYPE_LABELS).map(([key, val]) => (
              <SelectItem key={key} value={key}>
                {val.icon} {isRTL ? val.ar : val.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{isRTL ? "نوع الكيان" : "Entity Type"}</Label>
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((et) => (
              <SelectItem key={et.value} value={et.value}>
                {isRTL ? et.ar : et.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{isRTL ? "الوصف" : "Description"}</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>

      {/* Dynamic config fields */}
      {policyType === "approval_limit" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{isRTL ? "الحد الأقصى (افتراضي)" : "Max Amount (Default)"}</Label>
            <Input type="number" value={maxAmountDefault} onChange={(e) => setMaxAmountDefault(e.target.value)} placeholder="50000" />
          </div>
          <div>
            <Label>{isRTL ? "الحد الأقصى (مدير)" : "Max Amount (Admin)"}</Label>
            <Input type="number" value={maxAmountAdmin} onChange={(e) => setMaxAmountAdmin(e.target.value)} placeholder="200000" />
          </div>
        </div>
      )}

      {policyType === "transaction_limit" && (
        <div>
          <Label>{isRTL ? "الحد الأقصى يومياً" : "Max Per Day"}</Label>
          <Input type="number" value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)} placeholder="100" />
        </div>
      )}

      {policyType === "segregation_of_duties" && (
        <div>
          <Label>{isRTL ? "الإجراء المتعارض" : "Conflicting Action"}</Label>
          <Input value={conflictingAction} onChange={(e) => setConflictingAction(e.target.value)} placeholder="approve" />
          <p className="text-xs text-muted-foreground mt-1">
            {isRTL ? "مثال: لا يمكن لنفس المستخدم إنشاء واعتماد نفس الكيان" : "e.g. same user cannot create and approve the same entity"}
          </p>
        </div>
      )}

      {policyType === "restricted_access" && (
        <div className="space-y-3">
          <div>
            <Label>{isRTL ? "الأدوار المحظورة (مفصولة بفاصلة)" : "Blocked Roles (comma-separated)"}</Label>
            <Input value={blockedRoles} onChange={(e) => setBlockedRoles(e.target.value)} placeholder="member, viewer" />
          </div>
          <div>
            <Label>{isRTL ? "الإجراء المحظور (اختياري)" : "Blocked Action (optional)"}</Label>
            <Input value={blockedAction} onChange={(e) => setBlockedAction(e.target.value)} placeholder="delete" />
          </div>
        </div>
      )}

      <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full">
        {createMutation.isPending
          ? (isRTL ? "جاري الإنشاء..." : "Creating...")
          : (isRTL ? "إنشاء السياسة" : "Create Policy")}
      </Button>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────── */
const GovernancePage = () => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  // Fetch policies
  const { data: policies = [], isLoading: loadingPolicies } = useQuery({
    queryKey: ["governance-policies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("governance_policies")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch violations
  const { data: violations = [], isLoading: loadingViolations } = useQuery({
    queryKey: ["policy-violations", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("policy_violations")
        .select("*, governance_policies(name, name_en, policy_type)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Toggle policy active state
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("governance_policies")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-policies"] });
      toast.success(isRTL ? "تم تحديث السياسة" : "Policy updated");
    },
  });

  const activeCount = policies.filter((p: any) => p.is_active).length;
  const unresolvedViolations = violations.filter((v: any) => !v.resolved).length;

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div className={isRTL ? "text-right" : ""}>
            <h1 className="text-2xl font-bold">{isRTL ? "الحوكمة والامتثال" : "Governance & Compliance"}</h1>
            <p className="text-sm text-muted-foreground">
              {isRTL ? "إدارة سياسات الأمان وتتبع الانتهاكات" : "Manage security policies and track violations"}
            </p>
          </div>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 me-2" /> {isRTL ? "سياسة جديدة" : "New Policy"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isRTL ? "إنشاء سياسة حوكمة" : "Create Governance Policy"}</DialogTitle>
            </DialogHeader>
            <PolicyForm onClose={() => setShowCreate(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-5 text-center">
              <div className="text-3xl font-bold text-primary">{policies.length}</div>
              <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي السياسات" : "Total Policies"}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="pt-5 text-center">
              <div className="text-3xl font-bold text-green-500">{activeCount}</div>
              <p className="text-sm text-muted-foreground">{isRTL ? "سياسات نشطة" : "Active Policies"}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-5 text-center">
              <div className="text-3xl font-bold text-red-500">{unresolvedViolations}</div>
              <p className="text-sm text-muted-foreground">{isRTL ? "انتهاكات غير محلولة" : "Unresolved Violations"}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardContent className="pt-5 text-center">
              <div className="text-3xl font-bold text-muted-foreground">{violations.length}</div>
              <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الانتهاكات" : "Total Violations"}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="policies" dir={isRTL ? "rtl" : "ltr"}>
        <TabsList>
          <TabsTrigger value="policies">
            <Shield className="w-4 h-4 me-1" />
            {isRTL ? "السياسات" : "Policies"} ({policies.length})
          </TabsTrigger>
          <TabsTrigger value="violations">
            <AlertTriangle className="w-4 h-4 me-1" />
            {isRTL ? "الانتهاكات" : "Violations"} ({violations.length})
          </TabsTrigger>
        </TabsList>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-3 mt-4">
          {loadingPolicies ? (
            <div className="text-center py-10 text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading..."}</div>
          ) : policies.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Shield className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">{isRTL ? "لا توجد سياسات حوكمة بعد" : "No governance policies yet"}</p>
                <Button variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 me-2" /> {isRTL ? "إنشاء أول سياسة" : "Create first policy"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            policies.map((policy: any) => {
              const typeInfo = POLICY_TYPE_LABELS[policy.policy_type as PolicyType];
              return (
                <motion.div key={policy.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className={!policy.is_active ? "opacity-60" : ""}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{typeInfo?.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{isRTL ? policy.name : (policy.name_en || policy.name)}</span>
                              <Badge variant={policy.is_active ? "default" : "secondary"} className="text-[10px]">
                                {policy.is_active ? (isRTL ? "نشط" : "Active") : (isRTL ? "معطل" : "Inactive")}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {isRTL ? typeInfo?.ar : typeInfo?.en}
                              </Badge>
                            </div>
                            {policy.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{policy.description}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {isRTL ? "الكيان:" : "Entity:"} {(policy.config as any)?.applies_to_entity || (policy.config as any)?.entity_type || "all"}
                              {" • "}
                              {new Date(policy.created_at).toLocaleDateString(isRTL ? "ar-SA" : "en-US")}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMutation.mutate({ id: policy.id, isActive: policy.is_active })}
                        >
                          {policy.is_active ? (
                            <ToggleRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </TabsContent>

        {/* Violations Tab */}
        <TabsContent value="violations" className="space-y-3 mt-4">
          {loadingViolations ? (
            <div className="text-center py-10 text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading..."}</div>
          ) : violations.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500/40 mx-auto mb-3" />
                <p className="text-muted-foreground">{isRTL ? "لا توجد انتهاكات مسجلة" : "No violations recorded"}</p>
              </CardContent>
            </Card>
          ) : (
            violations.map((v: any) => {
              const policyName = v.governance_policies?.name || v.policy_id;
              const policyType = v.governance_policies?.policy_type as PolicyType;
              const typeInfo = POLICY_TYPE_LABELS[policyType];
              return (
                <motion.div key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className={v.resolved ? "opacity-60" : "border-red-500/20"}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <XCircle className={`w-5 h-5 ${v.resolved ? "text-muted-foreground" : "text-red-500"}`} />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {isRTL ? policyName : (v.governance_policies?.name_en || policyName)}
                              </span>
                              <Badge variant="destructive" className="text-[10px]">
                                {v.violation_type}
                              </Badge>
                              {v.resolved && (
                                <Badge variant="outline" className="text-[10px] text-green-600">
                                  {isRTL ? "تم الحل" : "Resolved"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {(v.details as any)?.reason || v.violation_type}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {isRTL ? "الكيان:" : "Entity:"} {v.entity_type}
                              {" • "}
                              {new Date(v.created_at).toLocaleString(isRTL ? "ar-SA" : "en-US")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GovernancePage;
