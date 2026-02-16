import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Save,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

interface CustomerForm {
  name: string;
  name_en: string;
  customer_type: string;
  email: string;
  phone: string;
  cr_number: string;
  vat_number: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  notes: string;
}

const emptyForm: CustomerForm = {
  name: "",
  name_en: "",
  customer_type: "business",
  email: "",
  phone: "",
  cr_number: "",
  vat_number: "",
  address_street: "",
  address_city: "",
  address_zip: "",
  notes: "",
};

const CustomersPage = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (!error && data) setCustomers(data);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filtered = customers.filter(
    (c) =>
      c.name.includes(search) ||
      (c.name_en && c.name_en.toLowerCase().includes(search.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search)) ||
      (c.cr_number && c.cr_number.includes(search))
  );

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setForm({
      name: c.name,
      name_en: c.name_en || "",
      customer_type: c.customer_type,
      email: c.email || "",
      phone: c.phone || "",
      cr_number: c.cr_number || "",
      vat_number: c.vat_number || "",
      address_street: c.address_street || "",
      address_city: c.address_city || "",
      address_zip: c.address_zip || "",
      notes: c.notes || "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!tenantId || !form.name.trim()) {
      toast({ title: "خطأ", description: "اسم العميل مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      customer_type: form.customer_type,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      cr_number: form.cr_number.trim() || null,
      vat_number: form.vat_number.trim() || null,
      address_street: form.address_street.trim() || null,
      address_city: form.address_city.trim() || null,
      address_zip: form.address_zip.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editingId);
      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "تم التحديث بنجاح" });
      }
    } else {
      const { error } = await supabase.from("customers").insert(payload);
      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "تمت الإضافة بنجاح" });
      }
    }

    setSaving(false);
    setShowForm(false);
    fetchCustomers();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحذف بنجاح" });
      fetchCustomers();
    }
    setDeletingId(null);
  };

  const updateField = (key: keyof CustomerForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Users size={24} className="text-accent" />
            إدارة العملاء
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إضافة وتعديل وإدارة بيانات العملاء وربطهم بالفواتير والعقود
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus size={16} />
          عميل جديد
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ابحث بالاسم، البريد، الهاتف، السجل التجاري..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Users size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "لا توجد نتائج للبحث" : "لا يوجد عملاء بعد. أضف أول عميل!"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-right font-semibold text-foreground">الاسم</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground hidden md:table-cell">النوع</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground hidden lg:table-cell">البريد</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground hidden lg:table-cell">الهاتف</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground hidden xl:table-cell">المدينة</th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground w-28">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{c.name}</p>
                      {c.name_en && <p className="text-[10px] text-muted-foreground font-english">{c.name_en}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.customer_type === "business"
                          ? "bg-accent/10 text-accent"
                          : "bg-info/10 text-info"
                      }`}>
                        {c.customer_type === "business" ? "شركة" : "فرد"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-english text-xs hidden lg:table-cell">
                      {c.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-english text-xs hidden lg:table-cell">
                      {c.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">
                      {c.address_city || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-accent" onClick={() => openEdit(c)}>
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={deletingId === c.id}
                          onClick={() => handleDelete(c.id)}
                        >
                          {deletingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} عميل
          </div>
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elevated"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-foreground">
                  {editingId ? "تعديل العميل" : "إضافة عميل جديد"}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                  <X size={18} />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Name */}
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <User size={12} /> الاسم بالعربي *
                  </Label>
                  <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} className="mt-1" placeholder="شركة الأمل" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">الاسم بالإنجليزي</Label>
                  <Input value={form.name_en} onChange={(e) => updateField("name_en", e.target.value)} className="mt-1 font-english" dir="ltr" placeholder="Al Amal Co." />
                </div>

                {/* Type */}
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 size={12} /> نوع العميل
                  </Label>
                  <select
                    value={form.customer_type}
                    onChange={(e) => updateField("customer_type", e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="business">شركة / مؤسسة</option>
                    <option value="individual">فرد</option>
                  </select>
                </div>

                {/* Contact */}
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail size={12} /> البريد الإلكتروني
                  </Label>
                  <Input value={form.email} onChange={(e) => updateField("email", e.target.value)} className="mt-1 font-english" dir="ltr" type="email" placeholder="info@company.com" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone size={12} /> الهاتف
                  </Label>
                  <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className="mt-1 font-english" dir="ltr" placeholder="+966 5X XXX XXXX" />
                </div>

                {/* Registration */}
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText size={12} /> السجل التجاري
                  </Label>
                  <Input value={form.cr_number} onChange={(e) => updateField("cr_number", e.target.value)} className="mt-1 font-english" dir="ltr" placeholder="10XXXXXXXX" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">الرقم الضريبي</Label>
                  <Input value={form.vat_number} onChange={(e) => updateField("vat_number", e.target.value)} className="mt-1 font-english" dir="ltr" placeholder="3XXXXXXXXXX00003" />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin size={12} /> العنوان
                  </Label>
                  <div className="grid gap-2 mt-1 md:grid-cols-3">
                    <Input value={form.address_street} onChange={(e) => updateField("address_street", e.target.value)} placeholder="الشارع" />
                    <Input value={form.address_city} onChange={(e) => updateField("address_city", e.target.value)} placeholder="المدينة" />
                    <Input value={form.address_zip} onChange={(e) => updateField("address_zip", e.target.value)} placeholder="الرمز البريدي" dir="ltr" className="font-english" />
                  </div>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">ملاحظات</Label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                    placeholder="ملاحظات إضافية..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingId ? "تحديث" : "إضافة"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomersPage;
