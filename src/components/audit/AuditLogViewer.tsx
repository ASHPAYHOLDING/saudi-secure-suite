import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Search, Filter, FileText, FileSignature, Stamp, Clock, User } from "lucide-react";
import { formatDateAr } from "@/lib/invoice-utils";

const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  sign: "توقيع",
  cancel: "إلغاء",
  mark_paid: "تأكيد الدفع",
};

const ENTITY_LABELS: Record<string, { label: string; icon: typeof FileText }> = {
  invoice: { label: "فاتورة", icon: FileText },
  contract: { label: "عقد", icon: FileSignature },
  stamp: { label: "ختم", icon: Stamp },
  template: { label: "قالب", icon: FileText },
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-success/10 text-success",
  update: "bg-info/10 text-info",
  delete: "bg-destructive/10 text-destructive",
  sign: "bg-accent/10 text-accent",
  cancel: "bg-warning/10 text-warning",
  mark_paid: "bg-success/10 text-success",
};

// Demo audit data
const demoLogs = [
  { id: "1", action: "create", entity_type: "invoice", entity_label: "INV-202602-0001", user_name: "أحمد الخالد", user_role: "محاسب", created_at: "2026-02-10T09:15:00Z", changes: {} },
  { id: "2", action: "update", entity_type: "stamp", entity_label: "شركة التقنية المتقدمة", user_name: "محمد العلي", user_role: "مالك", created_at: "2026-02-10T10:30:00Z", changes: { stamp_enabled: { old: false, new: true } } },
  { id: "3", action: "create", entity_type: "contract", entity_label: "CON-2026-0002", user_name: "أحمد الخالد", user_role: "مدير", created_at: "2026-02-11T08:00:00Z", changes: {} },
  { id: "4", action: "sign", entity_type: "contract", entity_label: "CON-2026-0001", user_name: "محمد العلي", user_role: "مالك", created_at: "2026-02-12T14:20:00Z", changes: { old_status: "active", new_status: "signed" } },
  { id: "5", action: "update", entity_type: "invoice", entity_label: "INV-202602-0001", user_name: "أحمد الخالد", user_role: "محاسب", created_at: "2026-02-13T11:45:00Z", changes: { old_status: "draft", new_status: "issued" } },
  { id: "6", action: "mark_paid", entity_type: "invoice", entity_label: "INV-202602-0001", user_name: "أحمد الخالد", user_role: "محاسب", created_at: "2026-02-14T16:00:00Z", changes: { old_status: "issued", new_status: "paid" } },
  { id: "7", action: "create", entity_type: "contract", entity_label: "CON-2026-0003", user_name: "سارة أحمد", user_role: "مدير قسم", created_at: "2026-02-15T09:30:00Z", changes: {} },
  { id: "8", action: "delete", entity_type: "invoice", entity_label: "INV-202602-0005", user_name: "محمد العلي", user_role: "مالك", created_at: "2026-02-15T13:10:00Z", changes: {} },
];

const AuditLogViewer = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const filtered = demoLogs.filter((log) => {
    const matchSearch = log.entity_label.includes(searchTerm) || log.user_name.includes(searchTerm);
    const matchEntity = entityFilter === "all" || log.entity_type === entityFilter;
    const matchAction = actionFilter === "all" || log.action === actionFilter;
    return matchSearch && matchEntity && matchAction;
  });

  const entityFilters = [
    { value: "all", label: "الكل" },
    { value: "invoice", label: "فواتير" },
    { value: "contract", label: "عقود" },
    { value: "stamp", label: "أختام" },
  ];

  const actionFilters = [
    { value: "all", label: "كل الإجراءات" },
    { value: "create", label: "إنشاء" },
    { value: "update", label: "تعديل" },
    { value: "sign", label: "توقيع" },
    { value: "delete", label: "حذف" },
  ];

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Shield size={24} className="text-accent" />
          سجل المراجعة
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          تتبع جميع العمليات على الفواتير والعقود والأختام — متاح فقط للمدراء والمالكين
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث بالمرجع أو اسم المستخدم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background pr-10 pl-4 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={14} className="text-muted-foreground ml-1" />
          {entityFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setEntityFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                entityFilter === f.value
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {actionFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setActionFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                actionFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
      >
        <div className="divide-y divide-border">
          {filtered.map((log, i) => {
            const entityInfo = ENTITY_LABELS[log.entity_type] || { label: log.entity_type, icon: FileText };
            const EntityIcon = entityInfo.icon;
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.03 * i }}
                className="flex items-start gap-4 px-6 py-4 hover:bg-secondary/20 transition-colors"
              >
                {/* Icon */}
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <EntityIcon size={16} className="text-muted-foreground" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION_COLORS[log.action] || "bg-muted text-muted-foreground"}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    <span className="text-xs text-muted-foreground">{entityInfo.label}</span>
                    <span className="text-sm font-semibold text-foreground font-english">{log.entity_label}</span>
                  </div>

                  {/* Changes detail */}
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="mt-1.5 text-[10px] text-muted-foreground bg-secondary/30 rounded px-2 py-1 inline-block">
                      {Object.entries(log.changes).map(([key, val]) => {
                        if (typeof val === "object" && val !== null && "old" in val && "new" in val) {
                          return <span key={key}>{key}: {String(val.old)} → {String(val.new)} </span>;
                        }
                        return <span key={key}>{key}: {String(val)} </span>;
                      })}
                    </div>
                  )}
                </div>

                {/* User & Time */}
                <div className="text-left shrink-0 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-foreground">
                    <User size={12} className="text-muted-foreground" />
                    <span>{log.user_name}</span>
                    <span className="text-[10px] text-muted-foreground">({log.user_role})</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock size={10} />
                    <span>{formatDateAr(log.created_at)}</span>
                    <span className="font-english">
                      {new Date(log.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-muted-foreground text-sm">
              لا توجد سجلات مطابقة
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AuditLogViewer;
