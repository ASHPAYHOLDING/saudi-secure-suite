import { useEffect, useState } from "react";
import { Building2, Search, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface Tenant {
  id: string;
  name: string;
  name_en: string | null;
  email: string | null;
  phone: string | null;
  cr_number: string | null;
  vat_number: string | null;
  status: string;
  created_at: string;
  vat_registered: boolean;
}

const AdminCompanies = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [memberCount, setMemberCount] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, name_en, email, phone, cr_number, vat_number, status, created_at, vat_registered")
        .order("created_at", { ascending: false });
      if (data) {
        setTenants(data);
        // Fetch member counts
        const { data: members } = await supabase.from("tenant_members").select("tenant_id");
        if (members) {
          const counts: Record<string, number> = {};
          members.forEach((m) => { counts[m.tenant_id] = (counts[m.tenant_id] || 0) + 1; });
          setMemberCount(counts);
        }
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = tenants.filter(
    (t) => t.name.includes(search) || t.name_en?.toLowerCase().includes(search.toLowerCase()) || t.email?.includes(search)
  );

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { active: "bg-emerald-100 text-emerald-700", suspended: "bg-destructive/10 text-destructive", inactive: "bg-muted text-muted-foreground" };
    const labels: Record<string, string> = { active: "نشط", suspended: "معلق", inactive: "غير نشط" };
    return <Badge className={map[status] || map.active}>{labels[status] || status}</Badge>;
  };

  const toggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === "active" ? "suspended" : "active";
    await supabase.from("tenants").update({ status: newStatus }).eq("id", tenant.id);
    setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, status: newStatus } : t)));
    if (selected?.id === tenant.id) setSelected({ ...tenant, status: newStatus });
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة الشركات</h1>
          <p className="text-sm text-muted-foreground">جميع الشركات المسجلة في المنصة</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Building2 size={14} /> {tenants.length} شركة
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="ابحث بالاسم أو البريد..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الشركة</TableHead>
                  <TableHead className="text-right">البريد</TableHead>
                  <TableHead className="text-right">السجل التجاري</TableHead>
                  <TableHead className="text-right">الأعضاء</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.cr_number || "—"}</TableCell>
                    <TableCell>{memberCount[t.id] || 0}</TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(t)}><Eye size={16} /></Button>
                        <Button size="sm" variant={t.status === "active" ? "destructive" : "default"} onClick={() => toggleStatus(t)}>
                          {t.status === "active" ? "تعليق" : "تفعيل"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد شركات</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Company Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تفاصيل الشركة</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">الاسم:</span><span className="font-medium">{selected.name}</span></div>
              {selected.name_en && <div className="flex justify-between"><span className="text-muted-foreground">الاسم (EN):</span><span>{selected.name_en}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">البريد:</span><span>{selected.email || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">الهاتف:</span><span>{selected.phone || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">السجل التجاري:</span><span>{selected.cr_number || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">الرقم الضريبي:</span><span>{selected.vat_number || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">مسجل بالضريبة:</span><span>{selected.vat_registered ? "نعم" : "لا"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">الحالة:</span>{statusBadge(selected.status)}</div>
              <div className="flex justify-between"><span className="text-muted-foreground">تاريخ التسجيل:</span><span>{new Date(selected.created_at).toLocaleDateString("ar-SA")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">عدد الأعضاء:</span><span>{memberCount[selected.id] || 0}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCompanies;
