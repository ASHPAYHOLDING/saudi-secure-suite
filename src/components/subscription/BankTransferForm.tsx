import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Upload, CheckCircle2, Copy, AlertTriangle,
  FileText, X, Calendar, User, Hash, Banknote, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface BankTransferFormProps {
  amount: number;
  bankReference: string;
  onBankReferenceChange: (val: string) => void;
  receiptFile: File | null;
  onReceiptFileChange: (file: File | null) => void;
}

interface FieldError {
  bankName?: string;
  senderName?: string;
  bankReference?: string;
  transferDate?: string;
  amount?: string;
}

const BANK_INFO = {
  bankName: "البنك الأهلي السعودي",
  accountName: "شركة نيوماكسيو للتقنية",
  iban: "SA00 0000 0000 0000 0000 0000",
  ibanRaw: "SA0000000000000000000000",
};

const BankTransferForm = ({
  amount,
  bankReference,
  onBankReferenceChange,
  receiptFile,
  onReceiptFileChange,
}: BankTransferFormProps) => {
  const [senderBank, setSenderBank] = useState("");
  const [senderName, setSenderName] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [errors, setErrors] = useState<FieldError>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [ibanCopied, setIbanCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validate = (field?: string) => {
    const newErrors: FieldError = {};

    if (!field || field === "bankName") {
      if (!senderBank.trim()) newErrors.bankName = "يرجى إدخال اسم البنك المحوّل منه";
    }
    if (!field || field === "senderName") {
      if (!senderName.trim()) newErrors.senderName = "يرجى إدخال اسم صاحب الحساب";
    }
    if (!field || field === "bankReference") {
      if (!bankReference.trim()) newErrors.bankReference = "يرجى إدخال رقم العملية / المرجع";
      else if (bankReference.trim().length < 4) newErrors.bankReference = "رقم المرجع قصير جداً";
    }
    if (!field || field === "transferDate") {
      if (!transferDate) newErrors.transferDate = "يرجى تحديد تاريخ التحويل";
      else {
        const d = new Date(transferDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (d > today) newErrors.transferDate = "لا يمكن أن يكون التاريخ في المستقبل";
      }
    }

    if (field) {
      setErrors((prev) => ({ ...prev, [field]: newErrors[field as keyof FieldError] }));
    } else {
      setErrors(newErrors);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validate(field);
  };

  const copyIban = () => {
    navigator.clipboard.writeText(BANK_INFO.ibanRaw);
    setIbanCopied(true);
    toast({ title: "تم النسخ ✅", description: "تم نسخ رقم IBAN" });
    setTimeout(() => setIbanCopied(false), 2000);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      onReceiptFileChange(file);
    } else {
      toast({ title: "خطأ", description: "يرجى رفع صورة أو ملف PDF فقط", variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Recipient Bank Card */}
      <Card className="border-accent/20 bg-gradient-to-bl from-accent/5 via-background to-background overflow-hidden">
        <CardContent className="p-0">
          {/* Header stripe */}
          <div className="bg-gradient-to-l from-accent to-accent/80 px-4 py-3 flex items-center gap-2">
            <Building2 size={18} className="text-accent-foreground" />
            <span className="text-sm font-semibold text-accent-foreground">بيانات الحساب المستلم</span>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">البنك</span>
                <p className="text-sm font-semibold text-foreground">{BANK_INFO.bankName}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">اسم الحساب</span>
                <p className="text-sm font-semibold text-foreground">{BANK_INFO.accountName}</p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium">رقم الآيبان IBAN</span>
              <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2">
                <code className="flex-1 text-sm font-mono font-semibold tracking-wider text-foreground" dir="ltr">
                  {BANK_INFO.iban}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={copyIban}
                >
                  <AnimatePresence mode="wait">
                    {ibanCopied ? (
                      <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      </motion.div>
                    ) : (
                      <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Copy size={14} className="text-muted-foreground" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-accent/10 rounded-lg px-3 py-2.5 border border-accent/20">
              <span className="text-xs text-muted-foreground">المبلغ المطلوب تحويله</span>
              <span className="text-lg font-bold text-accent">{amount.toLocaleString("ar-SA")} ر.س</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Details Form */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="bg-muted/40 px-4 py-3 border-b flex items-center gap-2">
            <FileText size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">بيانات التحويل</span>
          </div>

          <div className="p-4 space-y-4">
            {/* Row 1: Bank Name + Sender Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Building2 size={12} className="text-muted-foreground" />
                  اسم البنك المحوّل منه <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="مثال: بنك الراجحي"
                  value={senderBank}
                  onChange={(e) => { setSenderBank(e.target.value); if (touched.bankName) validate("bankName"); }}
                  onBlur={() => handleBlur("bankName")}
                  className={errors.bankName && touched.bankName ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                <AnimatePresence>
                  {errors.bankName && touched.bankName && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[11px] text-destructive flex items-center gap-1"
                    >
                      <AlertTriangle size={10} /> {errors.bankName}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <User size={12} className="text-muted-foreground" />
                  اسم المحوّل <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="اسم صاحب الحساب المحوّل منه"
                  value={senderName}
                  onChange={(e) => { setSenderName(e.target.value); if (touched.senderName) validate("senderName"); }}
                  onBlur={() => handleBlur("senderName")}
                  className={errors.senderName && touched.senderName ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                <AnimatePresence>
                  {errors.senderName && touched.senderName && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[11px] text-destructive flex items-center gap-1"
                    >
                      <AlertTriangle size={10} /> {errors.senderName}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Row 2: Reference + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Hash size={12} className="text-muted-foreground" />
                  رقم العملية / المرجع <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="رقم المرجع من إيصال التحويل"
                  value={bankReference}
                  onChange={(e) => { onBankReferenceChange(e.target.value); if (touched.bankReference) validate("bankReference"); }}
                  onBlur={() => handleBlur("bankReference")}
                  className={`font-mono ${errors.bankReference && touched.bankReference ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                <AnimatePresence>
                  {errors.bankReference && touched.bankReference && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[11px] text-destructive flex items-center gap-1"
                    >
                      <AlertTriangle size={10} /> {errors.bankReference}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Calendar size={12} className="text-muted-foreground" />
                  تاريخ التحويل <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={transferDate}
                  onChange={(e) => { setTransferDate(e.target.value); if (touched.transferDate) validate("transferDate"); }}
                  onBlur={() => handleBlur("transferDate")}
                  max={new Date().toISOString().split("T")[0]}
                  className={errors.transferDate && touched.transferDate ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                <AnimatePresence>
                  {errors.transferDate && touched.transferDate && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[11px] text-destructive flex items-center gap-1"
                    >
                      <AlertTriangle size={10} /> {errors.transferDate}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Row 3: Amount (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Banknote size={12} className="text-muted-foreground" />
                المبلغ المحوّل (ر.س)
              </Label>
              <Input
                value={amount.toLocaleString("ar-SA")}
                readOnly
                disabled
                className="font-bold text-accent bg-muted/30"
              />
            </div>

            {/* Receipt Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Upload size={12} className="text-muted-foreground" />
                إرفاق إيصال التحويل
              </Label>

              {!receiptFile ? (
                <div
                  className="border-2 border-dashed border-border/70 rounded-xl p-6 text-center cursor-pointer
                    hover:border-accent/50 hover:bg-accent/5 transition-all duration-200"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Upload size={18} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">اسحب الملف هنا أو اضغط للاختيار</p>
                    <p className="text-[11px] text-muted-foreground/70">صورة أو PDF — الحد الأقصى 20 ميجا</p>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2.5"
                >
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{receiptFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatFileSize(receiptFile.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onReceiptFileChange(null)}
                  >
                    <X size={14} />
                  </Button>
                </motion.div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => onReceiptFileChange(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning Banner */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3"
      >
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">ملاحظة مهمة</p>
          <p className="text-[11px] text-amber-700 dark:text-amber-500 leading-relaxed">
            سيتم مراجعة طلبك واعتماد الترقية بعد التحقق من التحويل البنكي خلال 24 ساعة عمل كحد أقصى.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default BankTransferForm;
