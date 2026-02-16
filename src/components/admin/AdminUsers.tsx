import { useEffect, useState } from "react";
import { Users, Search, UserX, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  tenant_id: string | null;
  tenant_name?: string;
  role?: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك",
  admin: "مدير",
  manager: "مدير قسم",
  hr: "موارد بشرية",
  accountant: "محاسب",
  member: "موظف",
};

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
      toast({ title: "تم التحديث" });
    }
  };

  const filtered = users.filter(
    (u) => u.full_name.includes(search) || u.email.includes(search) || u.tenant_name?.includes(search)
  );

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
          <p className="text-sm text-muted-foreground">جميع المستخدمين المسجلين في المنصة</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Users size={14} /> {users.length} مستخدم
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="ابحث بالاسم أو البريد أو الشركة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
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
                  <TableHead className="text-right">البريد</TableHead>
                  <TableHead className="text-right">الشركة</TableHead>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">آخر دخول</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.tenant_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ROLE_LABELS[u.role || ""] || u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"}>
                        {u.is_active ? "نشط" : "معطل"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString("ar-SA") : "—"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant={u.is_active ? "destructive" : "default"} onClick={() => toggleActive(u)}>
                        {u.is_active ? <><UserX size={14} className="ml-1" /> تعطيل</> : <><UserCheck size={14} className="ml-1" /> تفعيل</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا يوجد مستخدمين</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
