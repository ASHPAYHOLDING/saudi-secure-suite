import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { secureRpc } from "@/lib/secure-rpc";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Database, Shield, Clock, Hash, CheckCircle2, AlertTriangle,
  RefreshCw, Layers, ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MigrationsDashboardPage = () => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const qc = useQueryClient();
  const [reindexOpen, setReindexOpen] = useState(false);
  const [tableName, setTableName] = useState("");
  const [indexName, setIndexName] = useState("");

  const { data: schemaInfo, isLoading: loadingSchema } = useQuery({
    queryKey: ["schema-checksum"],
    queryFn: async () => {
      const { data, error } = await secureRpc("get_schema_checksum", {});
      if (error) throw error;
      return (data as any[])?.[0] || null;
    },
  });

  const { data: migrations = [], isLoading: loadingMigrations } = useQuery({
    queryKey: ["applied-migrations"],
    queryFn: async () => {
      const { data, error } = await secureRpc("get_applied_migrations", {});
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const reindexMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await secureRpc("request_background_reindex", {
        p_table_name: tableName,
        p_index_name: indexName,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (id) => {
      toast.success(isRTL ? "تم جدولة إعادة الفهرسة" : "Reindex job scheduled", {
        description: `Job ID: ${id}`,
      });
      setReindexOpen(false);
      setTableName("");
      setIndexName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const t = (en: string, ar: string) => (isRTL ? ar : en);

  return (
    <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            {t("Schema Migrations", "ترحيل المخطط")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Zero-downtime migration tracking & schema integrity", "تتبع الترحيل بدون توقف وسلامة المخطط")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setReindexOpen(true)}>
          <RefreshCw className="h-4 w-4 me-1.5" />
          {t("Background Reindex", "إعادة فهرسة خلفية")}
        </Button>
      </div>

      {/* Schema Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10"><Hash className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs font-mono text-foreground truncate max-w-[140px]">
                  {loadingSchema ? "..." : schemaInfo?.schema_checksum?.slice(0, 12) || "—"}
                </p>
                <p className="text-xs text-muted-foreground">{t("Schema Checksum", "بصمة المخطط")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10"><Layers className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{loadingSchema ? "..." : schemaInfo?.table_count || 0}</p>
                <p className="text-xs text-muted-foreground">{t("Public Tables", "جداول عامة")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10"><ArrowUpDown className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{migrations.length}</p>
                <p className="text-xs text-muted-foreground">{t("Applied Migrations", "ترحيلات مطبقة")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-foreground">
                  {loadingSchema
                    ? "..."
                    : schemaInfo?.last_migration_at
                    ? new Date(schemaInfo.last_migration_at).toLocaleDateString(isRTL ? "ar-SA" : "en-US", { dateStyle: "medium" })
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">{t("Last Migration", "آخر ترحيل")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Migrations Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("Migration History", "سجل الترحيلات")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMigrations ? (
            <p className="text-center text-muted-foreground py-8">{t("Loading...", "جاري التحميل...")}</p>
          ) : migrations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("No migrations recorded", "لا توجد ترحيلات مسجلة")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Version", "الإصدار")}</TableHead>
                    <TableHead>{t("Description", "الوصف")}</TableHead>
                    <TableHead>{t("Checksum", "البصمة")}</TableHead>
                    <TableHead>{t("Applied At", "تاريخ التطبيق")}</TableHead>
                    <TableHead>{t("Compatible", "متوافق")}</TableHead>
                    <TableHead>{t("Applied By", "بواسطة")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {migrations.map((m: any) => (
                    <TableRow key={m.version}>
                      <TableCell>
                        <span className="font-mono text-xs">{m.version}</span>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{m.description || "—"}</TableCell>
                      <TableCell>
                        <span className="font-mono text-[10px] text-muted-foreground">{m.checksum?.slice(0, 10)}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.applied_at).toLocaleString(isRTL ? "ar-SA" : "en-US", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        {m.is_backward_compatible ? (
                          <Badge variant="secondary" className="text-[10px] gap-0.5">
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            {t("Yes", "نعم")}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] gap-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            {t("No", "لا")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.applied_by || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schema Checksum Detail */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t("Full Schema Checksum", "بصمة المخطط الكاملة")}</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground break-all bg-muted/30 p-3 rounded-lg">
            {loadingSchema ? "..." : schemaInfo?.schema_checksum || "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            {t(
              "MD5 hash of all public table columns and data types. Changes indicate schema drift.",
              "بصمة MD5 لجميع أعمدة الجداول العامة وأنواع البيانات. التغييرات تشير إلى انحراف المخطط."
            )}
          </p>
        </CardContent>
      </Card>

      {/* Reindex Dialog */}
      <Dialog open={reindexOpen} onOpenChange={setReindexOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              {t("Request Background Reindex", "طلب إعادة فهرسة خلفية")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Table Name", "اسم الجدول")}</Label>
              <Input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="e.g. invoices" />
            </div>
            <div>
              <Label>{t("Index Name", "اسم الفهرس")}</Label>
              <Input value={indexName} onChange={(e) => setIndexName(e.target.value)} placeholder="e.g. idx_invoices_tenant" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReindexOpen(false)}>{t("Cancel", "إلغاء")}</Button>
            <Button
              onClick={() => reindexMutation.mutate()}
              disabled={!tableName || !indexName || reindexMutation.isPending}
            >
              {reindexMutation.isPending ? t("Scheduling...", "جاري الجدولة...") : t("Schedule Reindex", "جدولة إعادة الفهرسة")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MigrationsDashboardPage;
