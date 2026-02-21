/**
 * SecretsVaultPanel — Embedded panel for managing provider secrets
 * Shows secret names (not values), last rotated date, and rotate/set buttons.
 * Permission: owner/admin/finance_admin only.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Key, Shield, RefreshCw, Plus, Clock, Eye, EyeOff,
  Lock, CheckCircle2, AlertTriangle, Loader2, Vault,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SecretEntry {
  id: string;
  provider_key: string;
  secret_name: string;
  created_at: string;
  rotated_at: string | null;
}

interface Props {
  providerKey: string;
  suggestedSecrets?: string[]; // e.g. ["api_key", "secret_key", "webhook_secret"]
}

const SecretsVaultPanel = ({ providerKey, suggestedSecrets = [] }: Props) => {
  const { user, tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"set" | "rotate">("set");
  const [targetName, setTargetName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [customName, setCustomName] = useState("");

  // Check role
  const { data: memberRole } = useQuery({
    queryKey: ["my-role", user?.id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_members")
        .select("role")
        .eq("user_id", user!.id)
        .eq("tenant_id", tenantId!)
        .single();
      return data?.role ?? "viewer";
    },
    enabled: !!user && !!tenantId,
  });

  const hasPermission = ["owner", "admin", "finance_admin"].includes(memberRole ?? "");

  // Fetch secrets list
  const { data: secrets, isLoading } = useQuery({
    queryKey: ["vault-secrets", tenantId, providerKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("secrets-vault", {
        body: { action: "list", provider_key: providerKey },
      });
      if (error) throw error;
      return (data?.data ?? []) as SecretEntry[];
    },
    enabled: !!tenantId && !!providerKey,
  });

  // Set/Rotate mutation
  const mutation = useMutation({
    mutationFn: async ({ action, name, value }: { action: string; name: string; value: string }) => {
      const { data, error } = await supabase.functions.invoke("secrets-vault", {
        body: { action, provider_key: providerKey, secret_name: name, secret_value: value },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success(dialogMode === "set" ? "تم حفظ السر بنجاح" : "تم تدوير السر بنجاح");
      queryClient.invalidateQueries({ queryKey: ["vault-secrets", tenantId, providerKey] });
      closeDialog();
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ");
    },
  });

  const openSetDialog = (name?: string) => {
    setDialogMode("set");
    setTargetName(name || "");
    setCustomName("");
    setSecretValue("");
    setShowValue(false);
    setDialogOpen(true);
  };

  const openRotateDialog = (name: string) => {
    setDialogMode("rotate");
    setTargetName(name);
    setSecretValue("");
    setShowValue(false);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSecretValue("");
    setShowValue(false);
  };

  const handleSubmit = () => {
    const name = dialogMode === "set" ? (targetName || customName) : targetName;
    if (!name.trim() || !secretValue.trim()) return;
    mutation.mutate({ action: dialogMode, name: name.trim(), value: secretValue });
  };

  const existingNames = new Set((secrets ?? []).map(s => s.secret_name));
  const missingSecrets = suggestedSecrets.filter(s => !existingNames.has(s));

  if (!hasPermission) {
    return (
      <Card className="border-border/30 bg-muted/20">
        <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
          <Lock size={18} />
          <p className="text-sm">إدارة الأسرار متاحة فقط لـ المالك / المسؤول / المدير المالي</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield size={15} className="text-primary" />
            خزنة الأسرار
            <Badge variant="outline" className="text-[10px] font-mono">AES-256-GCM</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* Existing secrets */}
              {(secrets ?? []).length > 0 && (
                <div className="space-y-2">
                  {(secrets ?? []).map(secret => (
                    <div
                      key={secret.id}
                      className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Key size={14} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-mono text-foreground">{secret.secret_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <CheckCircle2 size={10} className="text-success" />
                          <span>مُشفّر</span>
                          {secret.rotated_at && (
                            <>
                              <span>•</span>
                              <Clock size={10} />
                              <span>
                                آخر تدوير {formatDistanceToNow(new Date(secret.rotated_at), { addSuffix: true, locale: ar })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1 h-7 shrink-0"
                        onClick={() => openRotateDialog(secret.secret_name)}
                      >
                        <RefreshCw size={11} />
                        تدوير
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Missing suggested secrets */}
              {missingSecrets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle size={11} className="text-warning" />
                    أسرار مطلوبة لم تُضبط بعد:
                  </p>
                  {missingSecrets.map(name => (
                    <div
                      key={name}
                      className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 shrink-0">
                        <Key size={14} className="text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-mono text-foreground">{name}</p>
                        <p className="text-[11px] text-muted-foreground">غير مُعدّ</p>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="text-xs gap-1 h-7 shrink-0"
                        onClick={() => openSetDialog(name)}
                      >
                        <Plus size={11} />
                        إعداد
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add custom secret */}
              <Button
                size="sm"
                variant="ghost"
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground w-full justify-center"
                onClick={() => openSetDialog()}
              >
                <Plus size={12} />
                إضافة سر مخصص
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Set/Rotate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {dialogMode === "set" ? (
                <>
                  <Key size={16} className="text-primary" />
                  إعداد سر جديد
                </>
              ) : (
                <>
                  <RefreshCw size={16} className="text-primary" />
                  تدوير السر: <span className="font-mono text-sm">{targetName}</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {dialogMode === "set" && !targetName && (
              <div className="space-y-1.5">
                <Label className="text-xs">اسم السر</Label>
                <Input
                  placeholder="مثال: api_key"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="font-mono text-sm"
                  dir="ltr"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">القيمة {dialogMode === "rotate" ? "الجديدة" : ""}</Label>
              <div className="relative">
                <Input
                  type={showValue ? "text" : "password"}
                  placeholder="أدخل القيمة..."
                  value={secretValue}
                  onChange={e => setSecretValue(e.target.value)}
                  className="font-mono text-sm pe-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowValue(!showValue)}
                >
                  {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <Shield size={14} className="text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                سيتم تشفير القيمة بتقنية AES-256-GCM قبل الحفظ. لا يمكن لأي شخص استعادة القيمة الأصلية من قاعدة البيانات.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeDialog} className="text-xs">
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending || !secretValue.trim() || (dialogMode === "set" && !targetName && !customName.trim())}
              className="gap-1.5 text-xs"
            >
              {mutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : dialogMode === "set" ? (
                <Lock size={13} />
              ) : (
                <RefreshCw size={13} />
              )}
              {dialogMode === "set" ? "حفظ مشفّر" : "تدوير وحفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SecretsVaultPanel;
