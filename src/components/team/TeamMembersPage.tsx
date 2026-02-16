import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, ROLE_LABELS, ROLE_COLORS, type AppRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  UserPlus,
  Users,
  Trash2,
  Shield,
  Mail,
  Loader2,
} from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  role: AppRole;
  joined_at: string;
  profile: {
    full_name: string;
    email: string;
    avatar_url: string | null;
    job_title: string | null;
  } | null;
}

const ASSIGNABLE_ROLES: AppRole[] = ["admin", "manager", "hr", "accountant", "member"];

const TeamMembersPage = () => {
  const { user, tenantId } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("member");
  const [inviting, setInviting] = useState(false);
  const [userRole, setUserRole] = useState<AppRole>("member");
  const perms = usePermissions(userRole);

  const fetchMembers = async () => {
    if (!tenantId) return;
    setLoading(true);

    // Get current user role
    const { data: roleData } = await supabase.rpc("get_user_role", {
      _tenant_id: tenantId,
    });
    if (roleData) setUserRole(roleData as AppRole);

    // Get members with profiles
    const { data, error } = await supabase
      .from("tenant_members")
      .select("id, user_id, role, joined_at")
      .eq("tenant_id", tenantId)
      .order("joined_at", { ascending: true });

    if (error) {
      toast({ title: "خطأ", description: "فشل في تحميل الأعضاء", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch profiles for each member
    const memberIds = (data || []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, job_title")
      .in("id", memberIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    const enriched: TeamMember[] = (data || []).map((m) => ({
      ...m,
      role: m.role as AppRole,
      profile: profileMap.get(m.user_id) || null,
    }));

    setMembers(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [tenantId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !tenantId) return;
    setInviting(true);

    try {
      const { data, error } = await supabase.functions.invoke("invite-member", {
        body: {
          email: inviteEmail.trim(),
          full_name: inviteName.trim() || inviteEmail.trim(),
          role: inviteRole,
          tenant_id: tenantId,
        },
      });

      if (error) throw error;

      toast({ title: "تم الإرسال", description: `تمت دعوة ${inviteEmail} بنجاح` });
      setInviteEmail("");
      setInviteName("");
      setInviteRole("member");
      setInviteOpen(false);
      fetchMembers();
    } catch (err: any) {
      toast({
        title: "خطأ في الدعوة",
        description: err.message || "فشل في إرسال الدعوة",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: AppRole) => {
    const { error } = await supabase
      .from("tenant_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast({ title: "خطأ", description: "فشل في تغيير الدور", variant: "destructive" });
    } else {
      toast({ title: "تم التحديث", description: "تم تغيير دور العضو بنجاح" });
      fetchMembers();
    }
  };

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`هل أنت متأكد من إزالة ${memberName}؟`)) return;

    const { error } = await supabase
      .from("tenant_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({ title: "خطأ", description: "فشل في إزالة العضو", variant: "destructive" });
    } else {
      toast({ title: "تم الحذف", description: `تمت إزالة ${memberName} من الفريق` });
      fetchMembers();
    }
  };

  return (
    <div className="p-6 md:p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Users size={28} className="text-accent" />
            إدارة الفريق
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة أعضاء الفريق وتعيين الأدوار والصلاحيات
          </p>
        </div>

        {perms.can("users.manage") && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-accent-foreground shadow-accent-glow">
                <UserPlus size={18} className="ml-2" />
                دعوة عضو جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right">دعوة عضو جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>الاسم الكامل</Label>
                  <Input
                    placeholder="مثال: أحمد محمد"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    placeholder="example@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="mt-1"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>الدور</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            <Shield size={14} />
                            {ROLE_LABELS[role]}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="w-full gradient-accent text-accent-foreground"
                >
                  {inviting ? (
                    <Loader2 size={18} className="ml-2 animate-spin" />
                  ) : (
                    <Mail size={18} className="ml-2" />
                  )}
                  {inviting ? "جاري الإرسال..." : "إرسال الدعوة"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{members.length}</p>
          <p className="text-xs text-muted-foreground">إجمالي الأعضاء</p>
        </div>
        {(["admin", "accountant", "member"] as AppRole[]).map((role) => (
          <div key={role} className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-foreground">
              {members.filter((m) => m.role === role).length}
            </p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-accent" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Users size={48} className="mb-4 opacity-30" />
            <p>لا يوجد أعضاء حالياً</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">العضو</TableHead>
                <TableHead className="text-right">البريد</TableHead>
                <TableHead className="text-right">الوظيفة</TableHead>
                <TableHead className="text-right">الدور</TableHead>
                <TableHead className="text-right">تاريخ الانضمام</TableHead>
                {perms.can("users.manage") && (
                  <TableHead className="text-right">إجراءات</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isCurrentUser = member.user_id === user?.id;
                const isOwner = member.role === "owner";
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-bold">
                          {member.profile?.full_name?.[0] || "?"}
                        </div>
                        <span className="font-medium text-foreground">
                          {member.profile?.full_name || "—"}
                          {isCurrentUser && (
                            <span className="mr-2 text-xs text-muted-foreground">(أنت)</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm" dir="ltr">
                      {member.profile?.email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {member.profile?.job_title || "—"}
                    </TableCell>
                    <TableCell>
                      {perms.can("users.manage") && !isOwner && !isCurrentUser ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) => handleRoleChange(member.id, v as AppRole)}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`${ROLE_COLORS[member.role]} text-xs`}>
                          {ROLE_LABELS[member.role]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(member.joined_at).toLocaleDateString("ar-SA")}
                    </TableCell>
                    {perms.can("users.manage") && (
                      <TableCell>
                        {!isOwner && !isCurrentUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              handleRemove(member.id, member.profile?.full_name || "العضو")
                            }
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default TeamMembersPage;
