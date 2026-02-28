import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Link2, Plus, Copy, Share2, MessageSquare, Mail,
  CheckCircle2, Clock, XCircle, Ban, Loader2, ExternalLink, QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { usePaymentLinks, type CreatePaymentLinkInput } from "@/hooks/usePaymentLinks";
import { QRCodeSVG } from "qrcode.react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  created: { label: "جديد", color: "text-info border-info/30 bg-info/10", icon: Clock },
  paid: { label: "مدفوع", color: "text-success border-success/30 bg-success/10", icon: CheckCircle2 },
  expired: { label: "منتهي", color: "text-muted-foreground border-border bg-muted/50", icon: XCircle },
  canceled: { label: "ملغي", color: "text-destructive border-destructive/30 bg-destructive/10", icon: Ban },
};

const PaymentLinksTab = () => {
  const { links, loading, creating, createLink, cancelLink, getShareUrl } = usePaymentLinks();
  const [showCreate, setShowCreate] = useState(false);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [form, setForm] = useState<CreatePaymentLinkInput>({
    amount: 0, description: "", customer_name: null, customer_email: null, customer_phone: null, expires_at: null,
  });

  const filteredLinks = statusFilter === "all" ? links : links.filter((l) => l.status === statusFilter);

  const handleCreate = async () => {
    if (!form.amount || form.amount <= 0) { toast.error("يرجى إدخال مبلغ صحيح"); return; }
    if (!form.description.trim()) { toast.error("يرجى إدخال وصف الدفعة"); return; }
    const result = await createLink(form);
    if (result) {
      setShowCreate(false);
      setForm({ amount: 0, description: "", customer_name: null, customer_email: null, customer_phone: null, expires_at: null });
    }
  };

  const copyLink = (link: any) => {
    navigator.clipboard.writeText(getShareUrl(link));
    toast.success("تم نسخ الرابط");
  };

  const shareWhatsApp = (link: any) => {
    const url = getShareUrl(link);
    const text = `رابط الدفع: ${link.description}\nالمبلغ: ${link.amount} ${link.currency}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareEmail = (link: any) => {
    const url = getShareUrl(link);
    const subject = `رابط دفع - ${link.description}`;
    const body = `مرحباً،\n\nيرجى الدفع عبر الرابط التالي:\n\nالمبلغ: ${link.amount} ${link.currency}\nالوصف: ${link.description}\n\n${url}\n\nشكراً لك`;
    window.open(`mailto:${link.customer_email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  const formatCurrency = (n: number, c: string = "SAR") =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) + (c === "SAR" ? " ر.س" : ` ${c}`);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Link2 className="w-4 h-4 text-accent" /> روابط الدفع
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">أنشئ روابط دفع وشاركها مع عملائك</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2" size="sm">
          <Plus className="w-4 h-4" /> إنشاء رابط دفع
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 bg-muted rounded-lg p-0.5 w-fit">
        {[
          { key: "all", label: "الكل" },
          { key: "created", label: "جديد" },
          { key: "paid", label: "مدفوع" },
          { key: "expired", label: "منتهي" },
          { key: "canceled", label: "ملغي" },
        ].map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              statusFilter === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>{f.label}</button>
        ))}
      </div>

      {/* Links Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredLinks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Link2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">لا توجد روابط دفع{statusFilter !== "all" ? " بهذه الحالة" : " بعد"}</p>
            </div>
          ) : (
            <div className="rounded-lg border-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right font-semibold">الوصف</TableHead>
                    <TableHead className="text-right font-semibold">المبلغ</TableHead>
                    <TableHead className="text-right font-semibold">العميل</TableHead>
                    <TableHead className="text-right font-semibold">الحالة</TableHead>
                    <TableHead className="text-right font-semibold">التاريخ</TableHead>
                    <TableHead className="text-right font-semibold">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLinks.map((link) => {
                    const st = STATUS_MAP[link.status] || STATUS_MAP.created;
                    return (
                      <TableRow key={link.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm font-medium max-w-[200px] truncate">{link.description || "—"}</TableCell>
                        <TableCell className="text-sm font-semibold">{formatCurrency(link.amount, link.currency)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{link.customer_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs gap-1 ${st.color}`}>
                            <st.icon className="w-3 h-3" /> {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(link.created_at).toLocaleDateString("ar-SA")}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {link.status === "created" && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(link)} title="نسخ الرابط">
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shareWhatsApp(link)} title="مشاركة واتساب">
                                  <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shareEmail(link)} title="مشاركة بريد">
                                  <Mail className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowQr(getShareUrl(link))} title="QR Code">
                                  <QrCode className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => cancelLink(link.id)} title="إلغاء">
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                            {link.status === "paid" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(getShareUrl(link), "_blank")} title="عرض">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-accent" /> إنشاء رابط دفع جديد</DialogTitle>
            <DialogDescription>أنشئ رابط دفع وشاركه مع عميلك عبر واتساب أو بريد إلكتروني</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المبلغ *</Label>
                <Input type="number" placeholder="0.00" dir="ltr" value={form.amount || ""} onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ الانتهاء</Label>
                <Input type="date" dir="ltr" value={form.expires_at || ""} onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value || null }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>وصف الدفعة *</Label>
              <Textarea placeholder="مثلاً: دفعة مقدمة لمشروع التصميم" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">بيانات العميل (اختياري)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">الاسم</Label><Input placeholder="اسم العميل" value={form.customer_name || ""} onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value || null }))} /></div>
                <div className="space-y-1"><Label className="text-xs">البريد</Label><Input type="email" placeholder="email@example.com" dir="ltr" value={form.customer_email || ""} onChange={(e) => setForm((p) => ({ ...p, customer_email: e.target.value || null }))} /></div>
                <div className="space-y-1"><Label className="text-xs">الجوال</Label><Input placeholder="+966XXXXXXXXX" dir="ltr" value={form.customer_phone || ""} onChange={(e) => setForm((p) => ({ ...p, customer_phone: e.target.value || null }))} /></div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إنشاء الرابط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <Dialog open={!!showQr} onOpenChange={() => setShowQr(null)}>
        <DialogContent className="sm:max-w-xs text-center" dir="rtl">
          <DialogHeader><DialogTitle>رمز QR للدفع</DialogTitle></DialogHeader>
          {showQr && (
            <div className="flex justify-center py-4">
              <QRCodeSVG value={showQr} size={200} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">امسح الرمز لفتح صفحة الدفع</p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentLinksTab;
