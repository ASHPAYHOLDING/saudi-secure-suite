import { useState, useEffect } from "react";
import { useCenters } from "@/hooks/useCenters";
import { motion } from "framer-motion";
import { ArrowRight, Save, Loader2, Upload, X, Receipt, AlertCircle } from "lucide-react";
import { FormLabel } from "@/components/ui/form-tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/invoice-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ExpenseCreateProps {
  editId?: string | null;
  onBack: () => void;
  onSaved: (id: string) => void;
}

const generateExpenseNumber = (): string => {
  const now = new Date();
  return `EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;
};

const paymentMethods = [
  { value: "cash", label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "credit_card", label: "بطاقة ائتمان" },
  { value: "other", label: "أخرى" },
];

const ExpenseCreate = ({ editId, onBack, onSaved }: ExpenseCreateProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const [expenseNumber, setExpenseNumber] = useState(generateExpenseNumber);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState(0);
  const [vatRate, setVatRate] = useState(15);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptFilename, setReceiptFilename] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [profitCenterId, setProfitCenterId] = useState("");
  const { costCenters, profitCenters } = useCenters();

  // Computed
  const vatAmount = Math.round(amount * (vatRate / 100) * 100) / 100;
  const totalAmount = Math.round((amount + vatAmount) * 100) / 100;

  // Load categories
  const { data: categories = [], refetch: refetchCategories } = useQuery({
    queryKey: ["expense_categories", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("expense_categories").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Load existing expense for editing
  useEffect(() => {
    if (!editId || !tenantId) return;
    const load = async () => {
      const { data } = await supabase.from("expenses").select("*").eq("id", editId).single();
      if (data) {
        setExpenseNumber(data.expense_number);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setCategoryId(data.category_id || "");
        setAmount(data.amount || 0);
        setVatRate(data.vat_rate || 15);
        setExpenseDate(data.expense_date || "");
        setPaymentMethod(data.payment_method || "cash");
        setReceiptUrl(data.receipt_url);
        setReceiptFilename(data.receipt_filename);
        setNotes(data.notes || "");
      }
      setLoadingEdit(false);
    };
    load();
  }, [editId, tenantId]);

  const addCategory = async () => {
    if (!newCategoryName.trim() || !tenantId) return;
    const { data, error } = await supabase.from("expense_categories").insert({ tenant_id: tenantId, name: newCategoryName.trim() }).select("id").single();
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    if (data) { setCategoryId(data.id); setNewCategoryName(""); refetchCategories(); }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId || !user) return;
    const ext = file.name.split(".").pop();
    const path = `${tenantId}/${user.id}/${Date.now()}.${ext}`;
    setUploadingReceipt(true);
    const { error } = await supabase.storage.from("expense-receipts").upload(path, file);
    if (error) { toast({ title: "خطأ في رفع الملف", description: error.message, variant: "destructive" }); setUploadingReceipt(false); return; }
    const { data: urlData } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
    setReceiptUrl(urlData?.signedUrl || null);
    setReceiptFilename(file.name);
    setUploadingReceipt(false);
  };

  const removeReceipt = () => { setReceiptUrl(null); setReceiptFilename(null); };

  const handleSave = async () => {
    if (!tenantId || !user) return;
    if (!title.trim()) { toast({ title: "خطأ", description: "يرجى إدخال عنوان المصروف", variant: "destructive" }); return; }
    if (amount <= 0) { toast({ title: "خطأ", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" }); return; }

    setSaving(true);
    const expenseData: any = {
      title, description: description || null, category_id: categoryId || null,
      amount, vat_rate: vatRate, vat_amount: vatAmount, total_amount: totalAmount,
      expense_date: expenseDate, payment_method: paymentMethod,
      receipt_url: receiptUrl, receipt_filename: receiptFilename, notes: notes || null,
      cost_center_id: costCenterId || null,
      profit_center_id: profitCenterId || null,
    };

    if (editId) {
      const { error } = await supabase.from("expenses").update(expenseData).eq("id", editId);
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "تم تحديث المصروف" });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setSaving(false);
      onSaved(editId);
    } else {
      const { data, error } = await supabase.from("expenses").insert({
        tenant_id: tenantId, created_by: user.id, expense_number: expenseNumber, ...expenseData,
      }).select("id").single();
      if (error || !data) { toast({ title: "خطأ", description: error?.message || "فشل الحفظ", variant: "destructive" }); setSaving(false); return; }
      toast({ title: "تم حفظ المصروف" });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setSaving(false);
      onSaved(data.id);
    }
  };

  const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors";

  if (loadingEdit) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowRight size={18} /></Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{editId ? "تعديل المصروف" : "إضافة مصروف جديد"}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">رقم المصروف: <span className="font-english font-medium text-foreground">{expenseNumber}</span></p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          حفظ المصروف
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">بيانات المصروف</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormLabel label="العنوان" required tooltip="وصف مختصر للمصروف مثل: شراء مستلزمات مكتبية، اشتراك برنامج، صيانة مكيفات" />
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: شراء مستلزمات مكتبية" className={inputClass} />
              </div>
              <div>
                <FormLabel label="الفئة" tooltip="تصنيف المصروف يساعد في التقارير المالية. يمكنك إضافة فئة جديدة أدناه" />
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                  <option value="">— بدون فئة —</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1.5 block">الوصف</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="تفاصيل إضافية (اختياري)" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none transition-colors" />
              </div>
            </div>
            {/* Add new category inline */}
            <div className="mt-3 flex gap-2">
              <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="إضافة فئة جديدة..." className="flex-1 h-8 text-xs" />
              <Button size="sm" variant="outline" onClick={addCategory} disabled={!newCategoryName.trim()} className="h-8 text-xs">إضافة</Button>
            </div>
          </motion.div>

          {/* Financial */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">البيانات المالية</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FormLabel label="المبلغ (قبل الضريبة)" required tooltip="أدخل المبلغ الصافي بدون ضريبة القيمة المضافة. سيتم حساب الضريبة تلقائياً" />
                <input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} min="0" step="0.01" dir="ltr" className={`${inputClass} text-center font-english`} />
              </div>
              <div>
                <FormLabel label="نسبة الضريبة ٪" tooltip="١٥٪ هي نسبة ضريبة القيمة المضافة القياسية في السعودية. اختر ٠٪ للمصروفات المعفاة" />
                <select value={vatRate} onChange={(e) => setVatRate(parseFloat(e.target.value))} className={inputClass}>
                  <option value="0">0٪ (معفى)</option>
                  <option value="5">5٪</option>
                  <option value="15">15٪</option>
                </select>
              </div>
              <div>
                <FormLabel label="طريقة الدفع" tooltip="حدد كيف تم دفع هذا المصروف لتسهيل المطابقة البنكية" />
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                  {paymentMethods.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-secondary/30 p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">المبلغ</span>
                <span className="font-english font-medium">{formatCurrency(amount)} ر.س</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">ضريبة القيمة المضافة ({vatRate}٪)</span>
                <span className="font-english font-medium">{formatCurrency(vatAmount)} ر.س</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                <span>الإجمالي</span>
                <span className="font-english text-accent">{formatCurrency(totalAmount)} ر.س</span>
              </div>
            </div>
          </motion.div>

          {/* Receipt Upload */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">إيصال / فاتورة المورد</h3>
            {receiptUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-secondary/20">
                <Receipt size={20} className="text-accent shrink-0" />
                <span className="text-sm flex-1 truncate">{receiptFilename || "ملف مرفق"}</span>
                <Button size="icon" variant="ghost" onClick={removeReceipt} className="shrink-0"><X size={14} /></Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 cursor-pointer hover:border-accent/50 transition-colors">
                {uploadingReceipt ? <Loader2 size={24} className="animate-spin text-accent" /> : <Upload size={24} className="text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{uploadingReceipt ? "جاري الرفع..." : "اسحب الملف هنا أو اضغط للرفع"}</span>
                <span className="text-xs text-muted-foreground">PDF, JPG, PNG (حد أقصى 10MB)</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleReceiptUpload} className="hidden" disabled={uploadingReceipt} />
              </label>
            )}
          </motion.div>

          {/* Notes */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card">
            <label className="text-sm font-semibold text-foreground mb-2 block">ملاحظات</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="ملاحظات إضافية (اختياري)" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none transition-colors" />
          </motion.div>

          {/* Centers */}
          {(costCenters.length > 0 || profitCenters.length > 0) && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card">
              <h3 className="text-sm font-semibold text-foreground mb-4">التصنيف المالي</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {costCenters.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">مركز التكلفة</label>
                    <select value={costCenterId} onChange={e => setCostCenterId(e.target.value)} className={inputClass}>
                      <option value="">— بدون —</option>
                      {costCenters.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.name}</option>)}
                    </select>
                  </div>
                )}
                {profitCenters.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">مركز الربح</label>
                    <select value={profitCenterId} onChange={e => setProfitCenterId(e.target.value)} className={inputClass}>
                      <option value="">— بدون —</option>
                      {profitCenters.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">التاريخ</h3>
            <label className="text-xs text-muted-foreground mb-1.5 block">تاريخ المصروف</label>
            <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className={`${inputClass} font-english`} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card sticky top-24">
            <h3 className="text-sm font-semibold text-foreground mb-4">ملخص</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المبلغ</span>
                <span className="font-english font-medium" dir="ltr">{formatCurrency(amount)} ر.س</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الضريبة</span>
                <span className="font-english font-medium" dir="ltr">{formatCurrency(vatAmount)} ر.س</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold">الإجمالي</span>
                  <span className="text-xl font-bold font-english text-accent" dir="ltr">{formatCurrency(totalAmount)} ر.س</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseCreate;
