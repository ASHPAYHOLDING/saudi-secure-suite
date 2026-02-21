import { useState } from "react";
import {
  Crown, Briefcase, ShieldCheck, Search, Scale, CheckCircle2,
  Loader2, UserCog,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface RoleTemplate {
  key: string;
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  icon: React.ElementType;
  color: string;
  permissions: string[];
}

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: "cfo",
    nameEn: "CFO",
    nameAr: "المدير المالي",
    descEn: "Full financial oversight including reports, budgets, journal entries, and approval workflows.",
    descAr: "إشراف مالي كامل يشمل التقارير والميزانيات والقيود المحاسبية وسلاسل الموافقات.",
    icon: Crown,
    color: "#D4AF37",
    permissions: [
      "invoices.view", "invoices.create", "invoices.edit", "invoices.delete", "invoices.send",
      "expenses.view", "expenses.create", "expenses.edit", "expenses.delete",
      "reports.view", "reports.export",
      "budgets.view", "budgets.create", "budgets.edit",
      "journal.view", "journal.create", "journal.edit",
      "analytics.view",
      "company.view",
      "approvals.view", "approvals.approve",
      "credit_notes.view", "credit_notes.create",
      "wallet.view",
      "finance.view_executive_board",
    ],
  },
  {
    key: "finance_controller",
    nameEn: "Finance Controller",
    nameAr: "المراقب المالي",
    descEn: "Day-to-day financial operations, invoice management, and expense tracking.",
    descAr: "العمليات المالية اليومية وإدارة الفواتير وتتبع المصروفات.",
    icon: Briefcase,
    color: "#3B82F6",
    permissions: [
      "invoices.view", "invoices.create", "invoices.edit", "invoices.send",
      "expenses.view", "expenses.create", "expenses.edit",
      "reports.view",
      "journal.view", "journal.create",
      "credit_notes.view", "credit_notes.create",
      "customers.view", "customers.create",
      "analytics.view",
    ],
  },
  {
    key: "procurement_manager",
    nameEn: "Procurement Manager",
    nameAr: "مدير المشتريات",
    descEn: "Purchase orders, supplier management, goods receipts, and inventory oversight.",
    descAr: "أوامر الشراء وإدارة الموردين واستلام البضائع والإشراف على المخزون.",
    icon: UserCog,
    color: "#10B981",
    permissions: [
      "purchase_orders.view", "purchase_orders.create", "purchase_orders.edit",
      "inventory.view", "inventory.edit",
      "expenses.view", "expenses.create",
      "delivery_notes.view", "delivery_notes.create",
      "approvals.view",
    ],
  },
  {
    key: "internal_auditor",
    nameEn: "Internal Auditor",
    nameAr: "المدقق الداخلي",
    descEn: "Read-only access to all financial data, audit logs, and compliance reports.",
    descAr: "وصول للقراءة فقط لجميع البيانات المالية وسجلات التدقيق وتقارير الامتثال.",
    icon: Search,
    color: "#8B5CF6",
    permissions: [
      "invoices.view",
      "expenses.view",
      "reports.view", "reports.export",
      "journal.view",
      "audit.view",
      "analytics.view",
      "budgets.view",
      "credit_notes.view",
      "customers.view",
      "company.view",
    ],
  },
  {
    key: "compliance_officer",
    nameEn: "Compliance Officer",
    nameAr: "مسؤول الامتثال",
    descEn: "ZATCA compliance, VAT reports, audit trail monitoring, and regulatory settings.",
    descAr: "امتثال هيئة الزكاة والضريبة وتقارير الضريبة ومراقبة سجل التدقيق والإعدادات التنظيمية.",
    icon: Scale,
    color: "#F59E0B",
    permissions: [
      "invoices.view",
      "reports.view", "reports.export",
      "audit.view",
      "company.view",
      "analytics.view",
      "settings.view",
    ],
  },
];

const EnterpriseRoleTemplates = () => {
  const { tenantId, user } = useAuth();
  const { isRTL } = useLanguage();
  const [creating, setCreating] = useState<string | null>(null);
  const [created, setCreated] = useState<Set<string>>(new Set());

  const handleCreate = async (template: RoleTemplate) => {
    if (!tenantId || !user) return;
    setCreating(template.key);

    try {
      // Check if role already exists
      const { data: existing } = await supabase
        .from("custom_roles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", template.nameEn)
        .maybeSingle();

      if (existing) {
        toast.error(isRTL ? "هذا الدور موجود مسبقاً" : "This role already exists");
        setCreating(null);
        return;
      }

      // Insert custom role
      const { data: role, error: roleError } = await supabase
        .from("custom_roles")
        .insert({
          tenant_id: tenantId,
          name: template.nameEn,
          name_ar: template.nameAr,
          description: isRTL ? template.descAr : template.descEn,
          color: template.color,
          is_system: false,
          base_role: "member" as any,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (roleError) throw roleError;

      // Insert permissions
      const permRows = template.permissions.map((perm) => ({
        tenant_id: tenantId,
        role_id: role.id,
        permission_key: perm,
      }));

      const { error: permError } = await supabase
        .from("role_permissions")
        .insert(permRows);

      if (permError) throw permError;

      setCreated((prev) => new Set(prev).add(template.key));
      toast.success(isRTL ? `تم إنشاء دور "${template.nameAr}" بنجاح` : `Role "${template.nameEn}" created successfully`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isRTL ? "قوالب الأدوار المؤسسية" : "Corporate Role Templates"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRTL ? "إنشاء أدوار جاهزة بصلاحيات محددة مسبقاً بنقرة واحدة" : "Create preset roles with predefined permissions in one click"}
          </p>
        </div>
      </div>

      {/* Template Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_TEMPLATES.map((template, i) => {
          const Icon = template.icon;
          const isCreated = created.has(template.key);
          const isCreating = creating === template.key;

          return (
            <motion.div
              key={template.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card className="border-border/50 h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${template.color}20` }}
                    >
                      <Icon className="h-4.5 w-4.5" style={{ color: template.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm">
                        {isRTL ? template.nameAr : template.nameEn}
                      </CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-2 leading-relaxed">
                    {isRTL ? template.descAr : template.descEn}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 mt-auto space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {template.permissions.slice(0, 5).map((perm) => (
                      <Badge key={perm} variant="outline" className="text-[10px] px-1.5 py-0">
                        {perm.split(".")[0]}
                      </Badge>
                    ))}
                    {template.permissions.length > 5 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        +{template.permissions.length - 5}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={isCreated ? "outline" : "default"}
                    disabled={isCreating || isCreated}
                    onClick={() => handleCreate(template)}
                  >
                    {isCreating ? (
                      <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                    ) : isCreated ? (
                      <CheckCircle2 className="h-3.5 w-3.5 me-1.5 text-emerald-500" />
                    ) : null}
                    {isCreated
                      ? (isRTL ? "تم الإنشاء" : "Created")
                      : (isRTL ? "إنشاء الدور" : "Create Role")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default EnterpriseRoleTemplates;
