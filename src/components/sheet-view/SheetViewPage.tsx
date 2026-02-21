import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Table2, FileText, Receipt, Users, FileSignature, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AppRole } from "@/lib/access/types";
import InvoicesSheet from "./InvoicesSheet";
import ExpensesSheet from "./ExpensesSheet";
import CustomersSheet from "./CustomersSheet";
import QuotationsSheet from "./QuotationsSheet";

const SheetViewPage = () => {
  const { user, tenantId } = useAuth();
  const [userRole, setUserRole] = useState<AppRole>("member");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !tenantId) return;
    supabase
      .from("tenant_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single()
      .then(({ data }) => {
        setUserRole((data?.role as AppRole) || "member");
        setLoading(false);
      });
  }, [user, tenantId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const isFinance = ["owner", "admin", "accountant"].includes(userRole);
  const isAdmin = ["owner", "admin"].includes(userRole);

  return (
    <div dir="rtl" className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
          <Table2 size={20} className="text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">عرض الجدول</h1>
          <p className="text-xs text-muted-foreground">تعديل وإدارة البيانات المالية بشكل مباشر</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-1.5 text-xs text-muted-foreground flex flex-wrap gap-3">
        <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> تعديل الخلية</span>
        <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> إلغاء</span>
        <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Tab</kbd> الخلية التالية</span>
        <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Space</kbd> تحديد الصف</span>
      </div>

      <Tabs defaultValue="invoices" dir="rtl">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="invoices" className="gap-1.5 text-xs"><FileText size={14} />الفواتير</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5 text-xs"><Receipt size={14} />المصروفات</TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5 text-xs"><Users size={14} />العملاء</TabsTrigger>
          <TabsTrigger value="quotations" className="gap-1.5 text-xs"><FileSignature size={14} />عروض الأسعار</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <InvoicesSheet userRole={userRole} isFinance={isFinance} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesSheet userRole={userRole} isFinance={isFinance} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="customers">
          <CustomersSheet userRole={userRole} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="quotations">
          <QuotationsSheet userRole={userRole} isFinance={isFinance} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SheetViewPage;
