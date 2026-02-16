import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Save, Eye, FileSignature, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/invoice-utils";
import { generateContractNumber, getContractTypeLabel, defaultTemplates, fillTemplate } from "@/lib/contract-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ContractCreateProps {
  onBack: () => void;
  onPreview: (html: string) => void;
  onSaved: (id: string) => void;
}

interface CustomerOption { id: string; name: string; cr_number: string | null; vat_number: string | null; address_street: string | null; phone: string | null; }

const ContractCreate = ({ onBack, onPreview, onSaved }: ContractCreateProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [contractNumber] = useState(generateContractNumber);
  const [contractType, setContractType] = useState<string>("service");
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientCr, setClientCr] = useState("");
  const [clientVat, setClientVat] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0]);
  const [totalValue, setTotalValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<any>(null);

  useEffect(() => {
    if (!tenantId) return;
    supabase.from("customers").select("id, name, cr_number, vat_number, address_street, phone").eq("tenant_id", tenantId).eq("is_active", true).then(({ data }) => { if (data) setCustomers(data); });
    supabase.from("tenants").select("name, cr_number, vat_number, address_street, phone, email").eq("id", tenantId).single().then(({ data }) => { if (data) setTenant(data); });
  }, [tenantId]);

  // Auto-fill when customer selected
  useEffect(() => {
    const c = customers.find(c => c.id === customerId);
    if (c) {
      setClientName(c.name);
      setClientCr(c.cr_number || "");
      setClientVat(c.vat_number || "");
      setClientAddress(c.address_street || "");
      setClientPhone(c.phone || "");
    }
  }, [customerId, customers]);

  const company = tenant ? {
    name: tenant.name || "—",
    cr_number: tenant.cr_number || "",
    vat_number: tenant.vat_number || "",
    address: tenant.address_street || "",
    phone: tenant.phone || "",
    email: tenant.email || "",
  } : { name: "—", cr_number: "", vat_number: "", address: "", phone: "", email: "" };

  const templateBody = defaultTemplates[contractType]?.body || "";
  const filledHtml = useMemo(() => {
    const body = useCustom && customBody ? customBody : templateBody;
    return fillTemplate(body, company, { name: clientName || "—", cr_number: clientCr, vat_number: clientVat, address: clientAddress, phone: clientPhone }, { contract_number: contractNumber, start_date: startDate, end_date: endDate, total_value: totalValue, title: title || "—" });
  }, [contractType, clientName, clientCr, clientVat, clientAddress, clientPhone, startDate, endDate, totalValue, title, useCustom, customBody, templateBody, contractNumber, company]);

  const handleSave = async () => {
    if (!tenantId || !user) return;
    if (!title.trim()) { toast({ title: "خطأ", description: "موضوع العقد مطلوب", variant: "destructive" }); return; }

    setSaving(true);
    const { data, error } = await supabase.from("contracts").insert({
      tenant_id: tenantId,
      created_by: user.id,
      contract_number: contractNumber,
      title: title.trim(),
      contract_type: contractType,
      customer_id: customerId || null,
      start_date: startDate,
      end_date: endDate,
      total_value: totalValue,
      body_html: filledHtml,
      notes: notes || null,
      status: "draft",
    }).select("id").single();

    if (error || !data) {
      toast({ title: "خطأ", description: error?.message || "فشل حفظ العقد", variant: "destructive" });
    } else {
      toast({ title: "تم حفظ العقد بنجاح" });
      onSaved(data.id);
    }
    setSaving(false);
  };

  const typeOptions = [
    { value: "employment", label: "عقد عمل", icon: "👤" },
    { value: "service", label: "عقد خدمات", icon: "🤝" },
    { value: "payment", label: "اتفاقية دفع", icon: "💰" },
  ];

  return (
    <div dir="rtl" className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowRight size={18} /></Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">إنشاء عقد جديد</h1>
            <p className="text-xs text-muted-foreground mt-0.5">رقم العقد: <span className="font-english font-medium text-foreground">{contractNumber}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => onPreview(filledHtml)}><Eye size={16} />معاينة</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            حفظ العقد
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Contract Type */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">نوع العقد</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {typeOptions.map((t) => (
                <button key={t.value} onClick={() => { setContractType(t.value); setUseCustom(false); }} className={`flex items-center gap-3 rounded-xl border-2 p-4 text-sm font-medium transition-all ${contractType === t.value ? "border-accent bg-accent/5 text-foreground" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"}`}>
                  <span className="text-xl">{t.icon}</span><span>{t.label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Contract Info */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">بيانات العقد</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">{contractType === "employment" ? "المسمى الوظيفي *" : "موضوع العقد *"}</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={contractType === "employment" ? "مطور أنظمة أول" : "تطوير نظام إدارة المحتوى"} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">{contractType === "employment" ? "الأجر الشهري (ر.س)" : "قيمة العقد (ر.س)"}</label>
                  <input type="number" value={totalValue} onChange={(e) => setTotalValue(parseFloat(e.target.value) || 0)} min="0" dir="ltr" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english text-left focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">ملاحظات (اختياري)</label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Client — from customer list */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">{contractType === "employment" ? "بيانات الموظف (الطرف الثاني)" : "بيانات العميل (الطرف الثاني)"}</h3>
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-1.5 block">اختر من العملاء</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
                <option value="">— اختيار يدوي —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="text-xs text-muted-foreground mb-1.5 block">الاسم *</label><input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" /></div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block">السجل التجاري</label><input type="text" value={clientCr} onChange={(e) => setClientCr(e.target.value)} dir="ltr" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english text-left focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" /></div>
              {contractType !== "employment" && <div><label className="text-xs text-muted-foreground mb-1.5 block">الرقم الضريبي</label><input type="text" value={clientVat} onChange={(e) => setClientVat(e.target.value)} dir="ltr" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english text-left focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" /></div>}
              <div><label className="text-xs text-muted-foreground mb-1.5 block">العنوان</label><input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" /></div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block">الهاتف</label><input type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} dir="ltr" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english text-left focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" /></div>
            </div>
          </motion.div>

          {/* Custom Body */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">تعديل نص العقد</h3>
              <button onClick={() => { setUseCustom(!useCustom); if (!customBody) setCustomBody(templateBody); }} className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${useCustom ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>{useCustom ? "تعديل مخصص" : "القالب الافتراضي"}</button>
            </div>
            {useCustom ? (
              <textarea value={customBody} onChange={(e) => setCustomBody(e.target.value)} rows={12} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-xs font-english text-left focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none" dir="ltr" />
            ) : (
              <p className="text-xs text-muted-foreground">سيتم استخدام قالب <strong>{getContractTypeLabel(contractType)}</strong> الافتراضي.</p>
            )}
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">مدة العقد</h3>
            <div className="space-y-4">
              <div><label className="text-xs text-muted-foreground mb-1.5 block">تاريخ البداية</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" /></div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block">تاريخ الانتهاء</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border bg-card p-6 shadow-card sticky top-24">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><FileSignature size={16} className="text-accent" />ملخص العقد</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">النوع</span><span className="font-medium text-foreground">{getContractTypeLabel(contractType)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">الطرف الثاني</span><span className="font-medium text-foreground">{clientName || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">القيمة</span><span className="font-english font-bold text-accent">{formatCurrency(totalValue)} ر.س</span></div>
              <div className="border-t border-border pt-3"><p className="text-[10px] text-muted-foreground">يخضع هذا العقد لأحكام الأنظمة المعمول بها في المملكة العربية السعودية</p></div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ContractCreate;
