import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, X, Mail } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().trim().email("بريد إلكتروني غير صالح");

const ROLES = [
  { value: "admin", label: "مدير" },
  { value: "editor", label: "محرر" },
  { value: "viewer", label: "مشاهد" },
  { value: "accountant", label: "محاسب" },
];

interface Invite {
  email: string;
  role: string;
}

interface Props {
  onValidChange: (valid: boolean) => void;
  onSubmit: (data: Record<string, any>) => Promise<void>;
}

export default function StepInviteTeam({ onValidChange, onSubmit }: Props) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState("");

  // This step is always valid (optional)
  useEffect(() => {
    onValidChange(true);
  }, [onValidChange]);

  const addInvite = useCallback(() => {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError("أدخل بريداً إلكترونياً صالحاً");
      return;
    }
    if (invites.some((inv) => inv.email === result.data)) {
      setError("هذا البريد مضاف مسبقاً");
      return;
    }
    if (invites.length >= 10) {
      setError("الحد الأقصى 10 دعوات");
      return;
    }
    setInvites((prev) => [...prev, { email: result.data, role }]);
    setEmail("");
    setError("");
  }, [email, role, invites]);

  const removeInvite = (emailToRemove: string) => {
    setInvites((prev) => prev.filter((inv) => inv.email !== emailToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ invites });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-info/10 flex items-center justify-center mb-3">
          <Users className="w-7 h-7 text-info" />
        </div>
        <CardTitle className="text-xl">دعوة الفريق</CardTitle>
        <CardDescription>أضف أعضاء فريقك للعمل معاً — يمكنك التخطي والإضافة لاحقاً</CardDescription>
      </CardHeader>
      <CardContent>
        <form data-onboarding-form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="email@company.com"
                dir="ltr"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInvite())}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" onClick={addInvite}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {invites.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                الدعوات ({invites.length})
              </Label>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div
                    key={inv.email}
                    className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30"
                  >
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate" dir="ltr">
                      {inv.email}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {ROLES.find((r) => r.value === inv.role)?.label}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeInvite(inv.email)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invites.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">لم تتم إضافة أي دعوات بعد</p>
              <p className="text-xs mt-1">يمكنك دعوة فريقك لاحقاً من إعدادات الفريق</p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
