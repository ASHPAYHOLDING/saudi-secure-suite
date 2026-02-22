import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  FileText,
  Users,
  Package,
  BarChart3,
  Shield,
  Brain,
  CreditCard,
  Building2,
  Receipt,
  ClipboardCheck,
  Workflow,
  Lock,
  Globe,
  Landmark,
  CalendarClock,
  Search,
  Rocket,
  MessageSquare,
  Database,
  RefreshCw,
  Gauge,
  Zap,
  Bell,
  Settings,
  Star,
  Heart,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─── Icon Registry ─── */
const ICON_MAP: Record<string, LucideIcon> = {
  FileText, Users, Package, BarChart3, Shield, Brain, CreditCard,
  Building2, Receipt, ClipboardCheck, Workflow, Lock, Globe,
  Landmark, CalendarClock, Search, Rocket, MessageSquare,
  Database, RefreshCw, Gauge, Zap, Bell, Settings, Star, Heart,
  CheckCircle, AlertTriangle, TrendingUp, ArrowUpRight, Sparkles, Plus,
};

const ICON_NAMES = Object.keys(ICON_MAP);

const TAG_OPTIONS = ["نظام جديد", "تحسين", "إصلاح", "أداء"] as const;
const TAG_STYLES: Record<string, string> = {
  "نظام جديد": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "تحسين": "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "إصلاح": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "أداء": "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

interface PlatformUpdate {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  tag: string;
  published_at: string;
  is_published: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface FormData {
  title: string;
  description: string;
  icon_name: string;
  tag: string;
  is_published: boolean;
  published_at: string;
}

const emptyForm: FormData = {
  title: "",
  description: "",
  icon_name: "Zap",
  tag: "نظام جديد",
  is_published: true,
  published_at: new Date().toISOString().slice(0, 16),
};

const AdminUpdatesManager = () => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<PlatformUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterTag, setFilterTag] = useState<string>("الكل");

  const fetchUpdates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_updates")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) {
      toast.error("فشل في تحميل التحديثات");
    } else {
      setUpdates((data as PlatformUpdate[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("يرجى تعبئة العنوان والوصف");
      return;
    }
    if (!user) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      icon_name: form.icon_name,
      tag: form.tag,
      is_published: form.is_published,
      published_at: new Date(form.published_at).toISOString(),
    };

    if (editingId) {
      const { error } = await supabase
        .from("platform_updates")
        .update(payload)
        .eq("id", editingId);
      if (error) toast.error("فشل في تحديث السجل");
      else toast.success("تم تحديث التحديث بنجاح");
    } else {
      const { error } = await supabase
        .from("platform_updates")
        .insert({ ...payload, created_by: user.id });
      if (error) toast.error("فشل في إضافة التحديث");
      else toast.success("تم إضافة التحديث بنجاح");
    }

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchUpdates();
  };

  const handleEdit = (update: PlatformUpdate) => {
    setForm({
      title: update.title,
      description: update.description,
      icon_name: update.icon_name,
      tag: update.tag,
      is_published: update.is_published,
      published_at: update.published_at.slice(0, 16),
    });
    setEditingId(update.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا التحديث؟")) return;
    const { error } = await supabase.from("platform_updates").delete().eq("id", id);
    if (error) toast.error("فشل في الحذف");
    else {
      toast.success("تم الحذف");
      fetchUpdates();
    }
  };

  const togglePublish = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("platform_updates")
      .update({ is_published: !current })
      .eq("id", id);
    if (error) toast.error("فشل في تغيير الحالة");
    else fetchUpdates();
  };

  const filteredUpdates = filterTag === "الكل"
    ? updates
    : updates.filter((u) => u.tag === filterTag);

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">إدارة التحديثات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إضافة وتعديل التحديثات التي تظهر في صفحة سجل التحديثات
          </p>
        </div>
        <Button
          onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
          className="gap-2"
        >
          <Plus size={16} />
          إضافة تحديث جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{updates.length}</p>
          <p className="text-xs text-muted-foreground">إجمالي التحديثات</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-500">{updates.filter(u => u.is_published).length}</p>
          <p className="text-xs text-muted-foreground">منشور</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{updates.filter(u => !u.is_published).length}</p>
          <p className="text-xs text-muted-foreground">مسودة</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-sky-500">{updates.filter(u => u.tag === "نظام جديد").length}</p>
          <p className="text-xs text-muted-foreground">أنظمة جديدة</p>
        </div>
      </div>

      {/* Filter Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {["الكل", ...TAG_OPTIONS].map((tag) => (
          <button
            key={tag}
            onClick={() => setFilterTag(tag)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all border",
              filterTag === tag
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {editingId ? "تعديل التحديث" : "إضافة تحديث جديد"}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-2 hover:bg-muted rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">العنوان</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: نظام الفوترة الإلكترونية"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">الوصف</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="وصف تفصيلي للتحديث..."
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none"
              />
            </div>

            {/* Tag + Published At */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">النوع</label>
                <select
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  {TAG_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">تاريخ النشر</label>
                <input
                  type="datetime-local"
                  value={form.published_at}
                  onChange={(e) => setForm({ ...form, published_at: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">الأيقونة</label>
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-2 max-h-40 overflow-y-auto rounded-xl border border-border p-3 bg-background">
                {ICON_NAMES.map((name) => {
                  const IconComp = ICON_MAP[name];
                  const isSelected = form.icon_name === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setForm({ ...form, icon_name: name })}
                      title={name}
                      className={cn(
                        "flex items-center justify-center w-9 h-9 rounded-lg transition-all",
                        isSelected
                          ? "bg-accent text-accent-foreground ring-2 ring-accent"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <IconComp size={18} />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">الأيقونة المحددة: {form.icon_name}</p>
            </div>

            {/* Publish Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setForm({ ...form, is_published: !form.is_published })}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors",
                  form.is_published ? "bg-accent" : "bg-muted"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                  form.is_published ? "start-0.5" : "start-[22px]"
                )} />
              </button>
              <span className="text-sm text-foreground">
                {form.is_published ? "منشور" : "مسودة"}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2 flex-1">
                <Save size={16} />
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة التحديث"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Updates List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-muted/10">
          <Rocket size={40} className="mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-foreground font-medium">لا توجد تحديثات بعد</p>
          <p className="text-sm text-muted-foreground mt-1">ابدأ بإضافة أول تحديث</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUpdates.map((update) => {
            const IconComp = ICON_MAP[update.icon_name] || Zap;
            const tagStyle = TAG_STYLES[update.tag] || TAG_STYLES["نظام جديد"];
            return (
              <div
                key={update.id}
                className={cn(
                  "rounded-xl border bg-card p-4 sm:p-5 transition-all",
                  update.is_published ? "border-border" : "border-dashed border-amber-500/30 bg-amber-500/[0.02]"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                    <IconComp size={18} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-bold text-foreground">{update.title}</h3>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border", tagStyle)}>
                        {update.tag}
                      </span>
                      {!update.is_published && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-500 px-2 py-0.5 text-[10px] font-bold border border-amber-500/20">
                          مسودة
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{update.description}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                      {new Date(update.published_at).toLocaleDateString("ar-SA", {
                        year: "numeric", month: "long", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => togglePublish(update.id, update.is_published)}
                      title={update.is_published ? "إخفاء" : "نشر"}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {update.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={() => handleEdit(update)}
                      title="تعديل"
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(update.id)}
                      title="حذف"
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminUpdatesManager;
