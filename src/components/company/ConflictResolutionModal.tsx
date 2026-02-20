/**
 * ConflictResolutionModal + RemoteChangeBanner
 *
 * Two UI pieces for the enterprise CAS smart-save system:
 *  - ConflictResolutionModal: shows side-by-side your vs. remote values
 *  - RemoteChangeBanner: non-blocking top banner for silent remote updates
 */

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, GitMerge, X, Check, RefreshCw, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConflictEntry, RemoteBanner } from "@/hooks/useSmartSaveSettingsCAS";

// ─── Human-readable key labels ─────────────────────────────────────────────────
const KEY_LABELS: Record<string, string> = {
  primary_color: "اللون الأساسي",
  secondary_color: "اللون الثانوي",
  font_family: "الخط",
  invoice_footer_text: "ذيل الفاتورة",
  email_signature: "توقيع البريد",
  website_url: "رابط الموقع",
  support_phone: "هاتف الدعم",
};

const labelFor = (key: string) => KEY_LABELS[key] ?? key;

// ─── ConflictResolutionModal ──────────────────────────────────────────────────

interface ConflictResolutionModalProps {
  conflicts: ConflictEntry[];
  onResolve: (key: string, choice: "local" | "remote") => void;
  onSaveResolved: () => void;
  onClose: () => void;
}

export const ConflictResolutionModal = ({
  conflicts,
  onResolve,
  onSaveResolved,
  onClose,
}: ConflictResolutionModalProps) => {
  const allResolved = conflicts.length === 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, y: 24, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.94, y: 24, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
          dir="rtl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card/95 backdrop-blur-sm rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-warning/15 flex items-center justify-center">
                <GitMerge size={17} className="text-warning" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">تعارض في الإعدادات</h2>
                <p className="text-xs text-muted-foreground">
                  {conflicts.length > 0
                    ? `${conflicts.length} حقل يحتاج مراجعة`
                    : "تم حل جميع التعارضات ✓"}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}>
              <X size={17} />
            </Button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {conflicts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
                  <Check size={28} className="text-success" />
                </div>
                <p className="text-base font-semibold text-foreground">جميع التعارضات محلولة</p>
                <p className="text-sm text-muted-foreground mt-1">يمكنك الآن حفظ التغييرات</p>
              </motion.div>
            ) : (
              <>
                {/* Info banner */}
                <div className="rounded-xl bg-warning/8 border border-warning/25 p-3.5 flex items-start gap-3">
                  <AlertTriangle size={15} className="text-warning mt-0.5 shrink-0" />
                  <p className="text-xs text-warning leading-relaxed">
                    تم تعديل الإعدادات من جلسة أخرى. اختر القيمة الصحيحة لكل حقل، أو اختر "دمج" إذا أردت الجمع بين النصوص.
                  </p>
                </div>

                {/* Conflict list */}
                <AnimatePresence mode="popLayout">
                  {conflicts.map((c) => (
                    <motion.div
                      key={c.key}
                      layout
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.22 }}
                      className="rounded-2xl border border-border overflow-hidden"
                    >
                      {/* Field title */}
                      <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
                        <p className="text-xs font-semibold text-foreground">{labelFor(c.key)}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{c.key}</p>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-border">
                        {/* Your value */}
                        <div className="p-4 space-y-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">قيمتك</p>
                          <ValuePreview value={c.localValue} />
                          <Button
                            size="sm"
                            className="w-full h-8 text-xs rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
                            onClick={() => onResolve(c.key, "local")}
                          >
                            <Check size={11} className="ml-1" /> استخدام قيمتي
                          </Button>
                        </div>

                        {/* Remote value */}
                        <div className="p-4 space-y-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">القيمة الحديثة</p>
                          <ValuePreview value={c.remoteValue} />
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs rounded-xl"
                            onClick={() => onResolve(c.key, "remote")}
                          >
                            <RefreshCw size={11} className="ml-1" /> استخدام الحديثة
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t border-border bg-card/95 backdrop-blur-sm rounded-b-2xl">
            <Button variant="outline" onClick={onClose} className="rounded-xl text-sm">
              إلغاء
            </Button>
            <Button
              onClick={onSaveResolved}
              disabled={conflicts.length > 0}
              className="rounded-xl text-sm bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Check size={14} className="ml-1.5" />
              {allResolved ? "حفظ التغييرات" : `تبقى ${conflicts.length} تعارض`}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── ValuePreview helper ──────────────────────────────────────────────────────

const ValuePreview = ({ value }: { value: unknown }) => {
  const str = value == null ? "—" : String(value);
  // Color swatch
  if (typeof str === "string" && /^#[0-9a-fA-F]{3,8}$/.test(str)) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-lg border border-border shrink-0" style={{ background: str }} />
        <span className="text-xs font-mono text-muted-foreground">{str}</span>
      </div>
    );
  }
  return (
    <p className="text-sm text-foreground break-words min-h-[32px] rounded-lg bg-muted/40 px-2.5 py-1.5">
      {str || <span className="text-muted-foreground/50 italic">فارغ</span>}
    </p>
  );
};

// ─── RemoteChangeBanner ──────────────────────────────────────────────────────

interface RemoteChangeBannerProps {
  banner: RemoteBanner;
  onReview: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}

export const RemoteChangeBanner = ({
  banner,
  onReview,
  onDiscard,
  onDismiss,
}: RemoteChangeBannerProps) => {
  const when = new Date(banner.remoteUpdatedAt).toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-2xl border border-warning/35 bg-warning/8 px-4 py-3.5 shadow-md"
        dir="rtl"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warning" />
          </span>
          <p className="text-sm text-warning font-medium leading-snug">
            تم تحديث الإعدادات من جلسة أخرى
            <span className="text-xs text-warning/70 font-normal mr-1.5">({when})</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-xl border-warning/40 text-warning hover:bg-warning/10 gap-1.5"
            onClick={onReview}
          >
            <Eye size={12} /> مراجعة
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-xl gap-1.5"
            onClick={onDiscard}
          >
            <Trash2 size={12} /> تجاهل تعديلاتي
          </Button>
          <button
            onClick={onDismiss}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── SaveStatusBadge ──────────────────────────────────────────────────────────

import type { SaveStatus } from "@/hooks/useSmartSaveSettingsCAS";
import { Loader2, Clock, CloudOff } from "lucide-react";

export const SaveStatusBadge = ({ status }: { status: SaveStatus }) => {
  const config: Record<SaveStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    idle:     { label: "",                    icon: null,                                        cls: "hidden" },
    saving:   { label: "جارٍ الحفظ...",      icon: <Loader2 size={11} className="animate-spin" />, cls: "text-muted-foreground" },
    saved:    { label: "تم الحفظ ✓",         icon: <Check size={11} />,                          cls: "text-success" },
    unsaved:  { label: "تغييرات غير محفوظة", icon: <Clock size={11} />,                          cls: "text-warning" },
    conflict: { label: "تعارض — يحتاج حل",  icon: <AlertTriangle size={11} />,                  cls: "text-destructive" },
  };

  const c = config[status];
  if (status === "idle") return null;

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className={`flex items-center gap-1.5 text-xs font-medium ${c.cls}`}
    >
      {c.icon}
      <span>{c.label}</span>
    </motion.div>
  );
};
