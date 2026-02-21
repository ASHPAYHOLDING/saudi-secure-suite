import { useEffect, useState, useCallback } from "react";
import {
  Globe, Plus, Trash2, ShieldAlert, ShieldCheck, Shield,
  Loader2, AlertTriangle, Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface AllowedIP {
  id: string;
  ip_address: string;
  label: string;
  created_at: string;
}

const EnterpriseIPRestrictions = () => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [ips, setIps] = useState<AllowedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [enforcing, setEnforcing] = useState(false);
  const [enforcementLoading, setEnforcementLoading] = useState(true);
  const [showEnforceWarning, setShowEnforceWarning] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load IPs
  const fetchIps = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("enterprise_allowed_ips")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (data) setIps(data as unknown as AllowedIP[]);
    setLoading(false);
  }, [tenantId]);

  // Load enforcement toggle
  const fetchEnforcement = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("enterprise_settings")
      .select("enforce_ip_restrictions")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    setEnforcing(data?.enforce_ip_restrictions ?? false);
    setEnforcementLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchIps(); fetchEnforcement(); }, [fetchIps, fetchEnforcement]);

  // Toggle enforcement
  const handleToggleEnforcement = async (enable: boolean) => {
    if (enable && ips.length === 0) {
      toast.error(isRTL ? "أضف عنوان IP واحد على الأقل قبل تفعيل التقييد" : "Add at least one IP before enabling restrictions");
      return;
    }
    if (enable) {
      setShowEnforceWarning(true);
      return;
    }
    await saveEnforcement(false);
  };

  const saveEnforcement = async (val: boolean) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from("enterprise_settings")
      .upsert({ tenant_id: tenantId, enforce_ip_restrictions: val }, { onConflict: "tenant_id" });
    if (error) { toast.error(error.message); return; }
    setEnforcing(val);
    setShowEnforceWarning(false);
    toast.success(isRTL
      ? (val ? "تم تفعيل تقييد IP" : "تم تعطيل تقييد IP")
      : (val ? "IP restrictions enabled" : "IP restrictions disabled"));
  };

  // Add IP
  const handleAdd = async () => {
    if (!tenantId || !newIp.trim()) return;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIp.trim())) {
      toast.error(isRTL ? "عنوان IP غير صالح" : "Invalid IP address");
      return;
    }
    setAdding(true);
    const { error } = await supabase
      .from("enterprise_allowed_ips")
      .insert({ tenant_id: tenantId, ip_address: newIp.trim(), label: newLabel.trim() });
    if (error) {
      toast.error(error.message.includes("duplicate") ? (isRTL ? "عنوان IP موجود مسبقاً" : "IP already exists") : error.message);
    } else {
      toast.success(isRTL ? "تمت إضافة العنوان" : "IP added");
      setNewIp("");
      setNewLabel("");
      setAddOpen(false);
      fetchIps();
    }
    setAdding(false);
  };

  // Remove IP
  const handleRemove = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase
      .from("enterprise_allowed_ips")
      .delete()
      .eq("id", id);
    if (error) { toast.error(error.message); }
    else {
      toast.success(isRTL ? "تم حذف العنوان" : "IP removed");
      setIps((prev) => prev.filter((ip) => ip.id !== id));
      // If last IP removed, disable enforcement
      if (ips.length <= 1 && enforcing) {
        await saveEnforcement(false);
      }
    }
    setDeleting(null);
  };

  if (loading || enforcementLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isRTL ? "تقييد عناوين IP" : "IP Restrictions"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRTL ? "السماح بالوصول فقط من عناوين IP محددة" : "Allow access only from specific IP addresses"}
            </p>
          </div>
        </div>
        <Badge variant={enforcing ? "default" : "secondary"} className="gap-1">
          {enforcing ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
          {enforcing ? (isRTL ? "مفعّل" : "Enforced") : (isRTL ? "معطّل" : "Disabled")}
        </Badge>
      </div>

      {/* Enforcement Toggle */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{isRTL ? "تفعيل تقييد IP" : "Enable IP Restrictions"}</p>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? "عند التفعيل، سيتم رفض تسجيل الدخول من أي عنوان IP غير مدرج" : "When enabled, login from unlisted IPs will be denied"}
                  </p>
                </div>
              </div>
              <Switch checked={enforcing} onCheckedChange={handleToggleEnforcement} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* IP List */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card className="border-border/50">
          <CardHeader className="pb-4 flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">{isRTL ? "عناوين IP المسموحة" : "Allowed IP Addresses"}</CardTitle>
              <CardDescription>{ips.length} {isRTL ? "عنوان" : "addresses"}</CardDescription>
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5 me-1.5" />
                  {isRTL ? "إضافة عنوان" : "Add IP"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isRTL ? "إضافة عنوان IP" : "Add IP Address"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>{isRTL ? "عنوان IP" : "IP Address"}</Label>
                    <Input
                      placeholder="192.168.1.1"
                      value={newIp}
                      onChange={(e) => setNewIp(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "التسمية (اختياري)" : "Label (optional)"}</Label>
                    <Input
                      placeholder={isRTL ? "مثال: مكتب الرياض" : "e.g. Riyadh Office"}
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAdd} disabled={adding || !newIp.trim()}>
                    {adding && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
                    {isRTL ? "إضافة" : "Add"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {ips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Globe className="h-10 w-10 mb-3" />
                <p className="text-sm">{isRTL ? "لم تتم إضافة أي عناوين IP بعد" : "No IP addresses added yet"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? "عنوان IP" : "IP Address"}</TableHead>
                      <TableHead>{isRTL ? "التسمية" : "Label"}</TableHead>
                      <TableHead>{isRTL ? "تاريخ الإضافة" : "Added"}</TableHead>
                      <TableHead className="text-end">{isRTL ? "إجراء" : "Action"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ips.map((ip) => (
                      <TableRow key={ip.id}>
                        <TableCell>
                          <span className="font-mono text-sm">{ip.ip_address}</span>
                        </TableCell>
                        <TableCell>
                          {ip.label ? (
                            <div className="flex items-center gap-1.5">
                              <Tag className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{ip.label}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(ip.created_at), "dd MMM yyyy", { locale: isRTL ? ar : enUS })}
                          </span>
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemove(ip.id)}
                            disabled={deleting === ip.id}
                          >
                            {deleting === ip.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="h-3.5 w-3.5 me-1" />
                                {isRTL ? "حذف" : "Remove"}
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Warning info */}
      {enforcing && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{isRTL ? "تقييد IP مفعّل" : "IP Restriction Active"}</p>
                  <p className="text-xs text-muted-foreground">
                    {isRTL
                      ? "أي محاولة تسجيل دخول من عنوان IP غير مدرج في القائمة سيتم رفضها تلقائياً وتسجيلها في سجل التدقيق."
                      : "Any login attempt from an IP not on this list will be automatically denied and logged in the audit trail."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Enforcement Warning Modal */}
      <AlertDialog open={showEnforceWarning} onOpenChange={setShowEnforceWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              {isRTL ? "تحذير: تفعيل تقييد IP" : "Warning: Enable IP Restrictions"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {isRTL
                  ? "بعد التفعيل، لن يتمكن أي مستخدم من تسجيل الدخول من عنوان IP غير مدرج في القائمة المسموحة."
                  : "Once enabled, no user will be able to log in from an IP address not on the allowed list."}
              </p>
              <p className="font-medium text-destructive">
                {isRTL
                  ? "⚠️ تأكد من إضافة عنوان IP الحالي الخاص بك لتجنب قفل حسابك."
                  : "⚠️ Make sure your current IP is listed to avoid locking yourself out."}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => saveEnforcement(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRTL ? "تفعيل التقييد" : "Enable Restrictions"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EnterpriseIPRestrictions;
