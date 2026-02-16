import { useEffect, useState } from "react";
import { Users, Search, UserX, UserCheck, Shield, Mail, Phone, Briefcase, Calendar, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  full_name: string;
  full_name_en: string | null;
  email: string;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  tenant_id: string | null;
  tenant_name?: string;
  role?: string;
  language: string;
  timezone: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك", admin: "مدير", manager: "مدير قسم", hr: "موارد بشرية", accountant: "محاسب", member: "موظف",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-accent/10 text-accent", admin: "bg-blue-100 text-blue-700", manager: "bg-violet-100 text-violet-700",
  hr: "bg-emerald-100 text-emerald-700", accountant: "bg-amber-100 text-amber-700", member: "bg-muted text-muted-foreground",
};

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [profilesRes, tenantsRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("tenants").select("id, name"),
        supabase.from("tenant_members").select("user_id, tenant_id, role"),
      ]);

      const tenantMap: Record<string, string> = {};
      tenantsRes.data?.forEach((t) => { tenantMap[t.id] = t.name; });

      const memberMap: Record<string, { tenant_id: string; role: string }> = {};
      membersRes.data?.forEach((m) => { memberMap[m.user_id] = { tenant_id: m.tenant_id, role: m.role }; });

      if (profilesRes.data) {
        setUsers(profilesRes.data.map((p) => ({
          ...p,
          tenant_name: p.tenant_id ? tenantMap[p.tenant_id] || "—" : "—",
          role: memberMap[p.id]?.role || "—",
        })));
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const toggleActive = async (user: UserProfile) => {
    const { error } = await supabase.from("profiles").update({ is_active: !user.is_active }).eq("id", user.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)));
      if (selectedUser?.id === user.id) setSelectedUser({ ...user, is_active: !user.is_active });
      toast({ title: "تم التحديث" });
    }
  };

  const filtered = users.filter((u) => {
    const matchSearch = u.full_name.includes(search) || u.email.includes(search) || u.tenant_name?.includes(search) || u.full_name_en?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? u.is_active : !u.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  const activeCount = users.filter((u) => u.is_active).length;
  const ownerCount = users.filter((u) => u.role === "owner").length;

  const timeAgo = (date: string | null) => {
    if (!date) return "لم يسجل دخول";
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "اليوم";
    if (days === 1) return "أمس";
    if (days < 7) return `منذ ${days} أيام`;
    if (days < 30) return `منذ ${Math.floor(days / 7)} أسابيع`;
    return `منذ ${Math.floor(days / 30)} أشهر`;
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
          <p className="text-sm text-muted-foreground">جميع المستخدمين المسجلين في المنصة</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1 bg-emerald-50">{activeCount} نشط</Badge>
          <Badge variant="outline" className="gap-1 bg-accent/5">{ownerCount} مالك</Badge>
          <Badge variant="outline" className="gap-1"><Users size={14} /> {users.length} مستخدم</Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-accent/10 p-2"><Users size={20} className="text-accent" /></div><div><p className="text-2xl font-bold">{users.length}</p><p className="text-xs text-muted-foreground">إجمالي المستخدمين</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-emerald-100 p-2"><UserCheck size={20} className="text-emerald-600" /></div><div><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">مستخدمين نشطين</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-destructive/10 p-2"><UserX size={20} className="text-destructive" /></div><div><p className="text-2xl font-bold">{users.length - activeCount}</p><p className="text-xs text-muted-foreground">مستخدمين معطلين</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-violet-100 p-2"><Shield size={20} className="text-violet-600" /></div><div><p className="text-2xl font-bold">{ownerCount}</p><p className="text-xs text-muted-foreground">مالكي شركات</p></div></CardContent></Card>
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="ابحث بالاسم أو البريد أو الشركة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="الدور" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأدوار</SelectItem>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">معطل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">الشركة</TableHead>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">آخر دخول</TableHead>
                  <TableHead className="text-right">تاريخ التسجيل</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedUser(u)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-accent/10 text-accent text-xs">{getInitials(u.full_name || u.email)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{u.full_name || "—"}</p>
                          <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.tenant_name}</TableCell>
                    <TableCell><Badge className={ROLE_COLORS[u.role || ""] || "bg-muted text-muted-foreground"}>{ROLE_LABELS[u.role || ""] || u.role}</Badge></TableCell>
                    <TableCell>
                      <Badge className={u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"}>
                        {u.is_active ? "نشط" : "معطل"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{timeAgo(u.last_login_at)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString("ar-SA")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedUser(u)}><Eye size={16} /></Button>
                        <Button size="sm" variant={u.is_active ? "destructive" : "default"} onClick={() => toggleActive(u)}>
                          {u.is_active ? <><UserX size={14} className="ml-1" /> تعطيل</> : <><UserCheck size={14} className="ml-1" /> تفعيل</>}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا يوجد مستخدمين مطابقين</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader><DialogTitle>تفاصيل المستخدم</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {/* User Header */}
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-accent/10 text-accent text-lg">{getInitials(selectedUser.full_name || selectedUser.email)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg">{selectedUser.full_name}</h3>
                  {selectedUser.full_name_en && <p className="text-sm text-muted-foreground">{selectedUser.full_name_en}</p>}
                  <div className="flex gap-2 mt-1">
                    <Badge className={ROLE_COLORS[selectedUser.role || ""] || ""}>{ROLE_LABELS[selectedUser.role || ""] || selectedUser.role}</Badge>
                    <Badge className={selectedUser.is_active ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"}>
                      {selectedUser.is_active ? "نشط" : "معطل"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem icon={Mail} label="البريد" value={selectedUser.email} />
                <DetailItem icon={Phone} label="الهاتف" value={selectedUser.phone} />
                <DetailItem icon={Briefcase} label="المسمى الوظيفي" value={selectedUser.job_title} />
                <DetailItem icon={Users} label="الشركة" value={selectedUser.tenant_name} />
                <DetailItem icon={Calendar} label="تاريخ التسجيل" value={new Date(selectedUser.created_at).toLocaleDateString("ar-SA")} />
                <DetailItem icon={Calendar} label="آخر دخول" value={selectedUser.last_login_at ? new Date(selectedUser.last_login_at).toLocaleDateString("ar-SA") : "لم يسجل دخول"} />
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button className="flex-1" variant={selectedUser.is_active ? "destructive" : "default"} onClick={() => toggleActive(selectedUser)}>
                  {selectedUser.is_active ? <><UserX size={16} className="ml-2" /> تعطيل المستخدم</> : <><UserCheck size={16} className="ml-2" /> تفعيل المستخدم</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DetailItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => (
  <div className="rounded-lg border p-3">
    <div className="flex items-center gap-1.5 mb-0.5">
      <Icon size={12} className="text-muted-foreground" />
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
    <p className="font-medium text-sm">{value || "—"}</p>
  </div>
);

export default AdminUsers;
