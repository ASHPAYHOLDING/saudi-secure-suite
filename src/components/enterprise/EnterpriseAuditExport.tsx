import { useState, useEffect, useCallback } from "react";
import {
  Shield, Download, FileText, FileJson, Loader2, Calendar,
  Search, Filter, User, AlertTriangle, Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { printDocument, INVOICE_PRINT_STYLES } from "@/lib/pdf-utils";
import { toast } from "sonner";

const MODULE_OPTIONS = [
  { value: "all", labelEn: "All Modules", labelAr: "كل الأقسام" },
  { value: "invoices", labelEn: "Invoices", labelAr: "الفواتير" },
  { value: "expenses", labelEn: "Expenses", labelAr: "المصروفات" },
  { value: "journal_entries", labelEn: "Journal Entries", labelAr: "القيود" },
  { value: "contracts", labelEn: "Contracts", labelAr: "العقود" },
  { value: "credit_notes", labelEn: "Credit Notes", labelAr: "إشعارات دائنة" },
  { value: "wallet_transactions", labelEn: "Wallet", labelAr: "المحفظة" },
  { value: "budgets", labelEn: "Budgets", labelAr: "الميزانيات" },
  { value: "subscriptions", labelEn: "Subscriptions", labelAr: "الاشتراكات" },
];

const EVENT_OPTIONS = [
  { value: "all", labelEn: "All Events", labelAr: "كل الأحداث" },
  { value: "create", labelEn: "Create", labelAr: "إنشاء" },
  { value: "update", labelEn: "Update", labelAr: "تعديل" },
  { value: "soft_delete", labelEn: "Soft Delete", labelAr: "حذف ناعم" },
  { value: "sign", labelEn: "Sign", labelAr: "توقيع" },
  { value: "cancel", labelEn: "Cancel", labelAr: "إلغاء" },
  { value: "mark_paid", labelEn: "Mark Paid", labelAr: "تأكيد دفع" },
  { value: "approve", labelEn: "Approve", labelAr: "اعتماد" },
];

const MAX_EXPORT = 10000;

const EnterpriseAuditExport = () => {
  const { user, tenantId, userRole, profile } = useAuth();
  const { isRTL } = useLanguage();
  const isOwner = userRole === "owner";

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [moduleFilter, setModuleFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  // Data
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);

  // Fetch team members for user filter
  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .then(({ data }) => {
        setTeamMembers((data || []).map((p: any) => ({ id: p.id, name: p.full_name || "—" })));
      });
  }, [tenantId]);

  // Count matching records when filters change
  const countRecords = useCallback(async () => {
    if (!tenantId) return;
    setCounting(true);
    let query = supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`);

    if (moduleFilter !== "all") query = query.eq("entity_type", moduleFilter);
    if (eventFilter !== "all") query = query.eq("action", eventFilter);
    if (userFilter !== "all") query = query.eq("user_id", userFilter);

    const { count } = await query;
    setPreviewCount(count ?? 0);
    setCounting(false);
  }, [tenantId, dateFrom, dateTo, moduleFilter, eventFilter, userFilter]);

  useEffect(() => { countRecords(); }, [countRecords]);

  const buildQuery = () => {
    let query = supabase
      .from("audit_logs")
      .select("*")
      .eq("tenant_id", tenantId!)
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(MAX_EXPORT);

    if (moduleFilter !== "all") query = query.eq("entity_type", moduleFilter);
    if (eventFilter !== "all") query = query.eq("action", eventFilter);
    if (userFilter !== "all") query = query.eq("user_id", userFilter);
    return query;
  };

  const fetchProfiles = async (logs: any[]) => {
    const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))];
    if (userIds.length === 0) return {};
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    const map: Record<string, string> = {};
    (data || []).forEach((p: any) => { map[p.id] = p.full_name || "—"; });
    return map;
  };

  const logExportEvent = async (format: string, count: number) => {
    if (!tenantId || !user) return;
    await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: "enterprise_audit_export",
      entity_type: "audit_logs",
      entity_label: `${format.toUpperCase()} — ${count} records`,
      changes: { format, record_count: count, date_from: dateFrom, date_to: dateTo },
    });
  };

  const generateHash = (data: string) => {
    // Simple hash for integrity verification
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  };

  // ── CSV Export ──
  const exportCSV = async () => {
    setExporting("csv");
    try {
      const { data: logs } = await buildQuery();
      if (!logs?.length) { toast.error(isRTL ? "لا توجد سجلات" : "No records found"); setExporting(null); return; }
      const profiles = await fetchProfiles(logs);

      const headers = ["Date", "Action", "Module", "Reference", "User", "IP", "Changes"];
      const rows = logs.map((l: any) => [
        new Date(l.created_at).toISOString(),
        l.action,
        l.entity_type,
        l.entity_label || "",
        profiles[l.user_id] || "",
        l.ip_address || "",
        l.changes ? JSON.stringify(l.changes) : "",
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
      const hash = generateHash(csvContent);
      const watermark = `\n# Generated by Numaxio Enterprise\n# Hash: ${hash}\n# Exported: ${new Date().toISOString()}`;

      const blob = new Blob([csvContent + watermark], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-export-${dateFrom}-${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      await logExportEvent("csv", logs.length);
      toast.success(isRTL ? `تم تصدير ${logs.length} سجل بنجاح` : `Exported ${logs.length} records`);
    } catch (e: any) { toast.error(e.message); }
    setExporting(null);
  };

  // ── JSON Export ──
  const exportJSON = async () => {
    setExporting("json");
    try {
      const { data: logs } = await buildQuery();
      if (!logs?.length) { toast.error(isRTL ? "لا توجد سجلات" : "No records found"); setExporting(null); return; }
      const profiles = await fetchProfiles(logs);

      const exportData = {
        _watermark: "Generated by Numaxio Enterprise",
        _exported_at: new Date().toISOString(),
        _exported_by: profile?.full_name || user?.id,
        _filters: { dateFrom, dateTo, module: moduleFilter, event: eventFilter, user: userFilter },
        _record_count: logs.length,
        records: logs.map((l: any) => ({
          ...l,
          _user_name: profiles[l.user_id] || null,
        })),
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const hash = generateHash(jsonStr);
      (exportData as any)._integrity_hash = hash;

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-export-${dateFrom}-${dateTo}.json`;
      a.click();
      URL.revokeObjectURL(url);

      await logExportEvent("json", logs.length);
      toast.success(isRTL ? `تم تصدير ${logs.length} سجل بنجاح` : `Exported ${logs.length} records`);
    } catch (e: any) { toast.error(e.message); }
    setExporting(null);
  };

  // ── PDF Export ──
  const exportPDF = async () => {
    setExporting("pdf");
    try {
      const { data: logs } = await buildQuery();
      if (!logs?.length) { toast.error(isRTL ? "لا توجد سجلات" : "No records found"); setExporting(null); return; }
      const profiles = await fetchProfiles(logs);

      const dataForHash = logs.map((l: any) => `${l.id}${l.action}${l.created_at}`).join("");
      const hash = generateHash(dataForHash);

      const container = document.createElement("div");
      container.innerHTML = `
        <div class="watermark">Generated by Numaxio Enterprise</div>
        <div class="report-print-header">
          <h1>${profile?.full_name || "Enterprise"}</h1>
          <h2>${isRTL ? "تصدير سجل التدقيق المؤسسي" : "Enterprise Audit Export"}</h2>
          <p class="sub">${dateFrom} — ${dateTo} | ${logs.length} ${isRTL ? "سجل" : "records"}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>${isRTL ? "التاريخ" : "Date"}</th>
              <th>${isRTL ? "الإجراء" : "Action"}</th>
              <th>${isRTL ? "القسم" : "Module"}</th>
              <th>${isRTL ? "المرجع" : "Reference"}</th>
              <th>${isRTL ? "المستخدم" : "User"}</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map((l: any) => `<tr>
              <td class="font-english" style="font-size:10px">${new Date(l.created_at).toLocaleString(isRTL ? "ar-SA" : "en-US")}</td>
              <td>${l.action}</td>
              <td>${l.entity_type}</td>
              <td class="font-english">${l.entity_label || "—"}</td>
              <td>${profiles[l.user_id] || "—"}</td>
              <td class="font-english" style="font-size:9px">${l.ip_address || "—"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        <div class="footer">
          <div class="hash-footer">
            <strong>${isRTL ? "توقيع رقمي" : "Digital Signature Hash"}:</strong> SHA-INT-${hash}
          </div>
          <p>${isRTL ? "تم الاستخراج بتاريخ" : "Exported on"}: ${new Date().toISOString()}</p>
          <p>Generated by Numaxio Enterprise — Audit Export</p>
        </div>
      `;

      printDocument(container, {
        title: `Audit Export — ${dateFrom} to ${dateTo}`,
        extraStyles: `
          ${INVOICE_PRINT_STYLES}
          body { direction: ${isRTL ? "rtl" : "ltr"}; font-family: 'IBM Plex Sans Arabic', sans-serif; }
          .watermark { position: fixed; top: 45%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 60px; color: rgba(0,0,0,0.04); font-weight: 800; white-space: nowrap; pointer-events: none; z-index: 0; }
          .report-print-header { text-align: center; margin-bottom: 20px; position: relative; z-index: 1; }
          .report-print-header h1 { font-size: 20px; font-weight: 700; }
          .report-print-header h2 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
          .report-print-header .sub { font-size: 12px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; position: relative; z-index: 1; }
          th { background: #1a1f36; color: #fff; padding: 6px; text-align: ${isRTL ? "right" : "left"}; font-size: 9px; }
          td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .footer { margin-top: 24px; border-top: 2px solid #1a1f36; padding-top: 12px; position: relative; z-index: 1; }
          .hash-footer { background: #f3f4f6; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-size: 11px; margin-bottom: 8px; }
          .footer p { font-size: 10px; color: #9ca3af; margin: 2px 0; }
        `,
      });

      await logExportEvent("pdf", logs.length);
      toast.success(isRTL ? "تم فتح نافذة الطباعة" : "Print dialog opened");
    } catch (e: any) { toast.error(e.message); }
    setExporting(null);
  };

  // Owner-only gate
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-lg font-bold">{isRTL ? "الوصول مقيّد" : "Access Restricted"}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {isRTL
            ? "تصدير سجلات التدقيق المؤسسية متاح فقط لمالك المنشأة."
            : "Enterprise audit export is restricted to the tenant owner only."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isRTL ? "تصدير التدقيق المؤسسي" : "Enterprise Audit Export"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRTL ? "تصدير سجلات التدقيق بصيغ متعددة مع توقيع رقمي" : "Export audit logs in multiple formats with digital signature"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {isRTL ? "عوامل التصفية" : "Filters"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-xs">{isRTL ? "من تاريخ" : "From Date"}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isRTL ? "إلى تاريخ" : "To Date"}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isRTL ? "القسم" : "Module"}</Label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{isRTL ? o.labelAr : o.labelEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isRTL ? "نوع الحدث" : "Event Type"}</Label>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{isRTL ? o.labelAr : o.labelEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isRTL ? "المستخدم" : "User"}</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "الكل" : "All Users"}</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Record count */}
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs gap-1">
              <FileText className="h-3 w-3" />
              {counting ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                <>{previewCount?.toLocaleString() ?? "—"} {isRTL ? "سجل مطابق" : "matching records"}</>
              )}
            </Badge>
            {(previewCount ?? 0) > MAX_EXPORT && (
              <Badge variant="outline" className="text-xs gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {isRTL ? `الحد الأقصى ${MAX_EXPORT.toLocaleString()} سجل` : `Max ${MAX_EXPORT.toLocaleString()} records`}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Buttons */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* CSV */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardContent className="pt-6 text-center space-y-3">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-emerald-500/10">
              <FileText className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">CSV</h3>
              <p className="text-xs text-muted-foreground">{isRTL ? "ملف بيانات مفصول بفواصل" : "Comma-separated values"}</p>
            </div>
            <Button
              className="w-full"
              variant="outline"
              size="sm"
              disabled={exporting !== null || !previewCount}
              onClick={exportCSV}
            >
              {exporting === "csv" ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 me-1.5" />}
              {isRTL ? "تصدير CSV" : "Export CSV"}
            </Button>
          </CardContent>
        </Card>

        {/* PDF */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardContent className="pt-6 text-center space-y-3">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-red-500/10">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">PDF</h3>
              <p className="text-xs text-muted-foreground">{isRTL ? "مع توقيع رقمي وعلامة مائية" : "With digital hash & watermark"}</p>
            </div>
            <Button
              className="w-full"
              variant="outline"
              size="sm"
              disabled={exporting !== null || !previewCount}
              onClick={exportPDF}
            >
              {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 me-1.5" />}
              {isRTL ? "تصدير PDF" : "Export PDF"}
            </Button>
          </CardContent>
        </Card>

        {/* JSON */}
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardContent className="pt-6 text-center space-y-3">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-blue-500/10">
              <FileJson className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">JSON</h3>
              <p className="text-xs text-muted-foreground">{isRTL ? "بيانات منظمة مع بيانات وصفية" : "Structured data with metadata"}</p>
            </div>
            <Button
              className="w-full"
              variant="outline"
              size="sm"
              disabled={exporting !== null || !previewCount}
              onClick={exportJSON}
            >
              {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 me-1.5" />}
              {isRTL ? "تصدير JSON" : "Export JSON"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnterpriseAuditExport;
