import { useEffect, useState } from "react";
import { Building2, Search, Eye, Download, Filter, MapPin, Calendar, Users as UsersIcon, FileText, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  industry: string | null;
  address_city: string | null;
  zatca_phase1_enabled: boolean;
}

interface TenantInvoice {
  id: string;
  invoice_number: string;
  status: string;
  grand_total: number;
  invoice_date: string;
}

interface TenantContract {
  id: string;
  contract_number: string;
  title: string;
  status: string;
  total_value: number;
}

interface TenantMember {
  user_id: string;
  role: string;
  joined_at: string;
  full_name?: string;
  email?: string;
}

const AdminCompanies = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [memberCount, setMemberCount] = useState<Record<string, number>>({});
  const [invoiceCount, setInvoiceCount] = useState<Record<string, number>>({});
  const [contractCount, setContractCount] = useState<Record<string, number>>({});

  // Detail dialog state
  const [detailTab, setDetailTab] = useState("info");
  const [detailInvoices, setDetailInvoices] = useState<TenantInvoice[]>([]);
  const [detailContracts, setDetailContracts] = useState<TenantContract[]>([]);
  const [detailMembers, setDetailMembers] = useState<TenantMember[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [tenantsRes, membersRes, invoicesRes, contractsRes] = await Promise.all([
        supabase.from("tenants").select("id, name, name_en, email, phone, cr_number, vat_number, status, created_at, vat_registered, industry, address_city, zatca_phase1_enabled").order("created_at", { ascending: false }),
        supabase.from("tenant_members").select("tenant_id"),
        supabase.from("invoices").select("tenant_id"),
        supabase.from("contracts").select("tenant_id"),
      ]);

      if (tenantsRes.data) setTenants(tenantsRes.data);

      const count = (data: { tenant_id: string }[] | null) => {
        const c: Record<string, number> = {};
        data?.forEach((r) => { c[r.tenant_id] = (c[r.tenant_id] || 0) + 1; });
        return c;
      };
      setMemberCount(count(membersRes.data));
      setInvoiceCount(count(invoicesRes.data));
      setContractCount(count(contractsRes.data));
      setLoading(false);
    };
    fetchData();
  }, []);

  const openDetail = async (tenant: Tenant) => {
    setSelected(tenant);
    setDetailTab("info");
    setDetailLoading(true);

    const [invRes, conRes, memRes] = await Promise.all([
      supabase.from("invoices").select("id, invoice_number, status, grand_total, invoice_date").eq("tenant_id", tenant.id).order("invoice_date", { ascending: false }).limit(10),
      supabase.from("contracts").select("id, contract_number, title, status, total_value").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("tenant_members").select("user_id, role, joined_at").eq("tenant_id", tenant.id),
    ]);

    setDetailInvoices((invRes.data as TenantInvoice[]) || []);
    setDetailContracts((conRes.data as TenantContract[]) || []);

    // Enrich members with profile data
    if (memRes.data && memRes.data.length > 0) {
      const userIds = memRes.data.map((m) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      const profileMap: Record<string, { full_name: string; email: string }> = {};
      profiles?.forEach((p) => { profileMap[p.id] = p; });
      setDetailMembers(memRes.data.map((m) => ({ ...m, full_name: profileMap[m.user_id]?.full_name || "—", email: profileMap[m.user_id]?.email || "—" })));
    } else {
      setDetailMembers([]);
    }
    setDetailLoading(false);
  };

  const toggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("tenants").update({ status: newStatus }).eq("id", tenant.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, status: newStatus } : t)));
    if (selected?.id === tenant.id) setSelected({ ...tenant, status: newStatus });
    toast({ title: "تم التحديث", description: newStatus === "suspended" ? "تم تعليق الشركة" : "تم تفعيل الشركة" });
  };

  const filtered = tenants.filter((t) => {
    const matchSearch = t.name.includes(search) || t.name_en?.toLowerCase().includes(search.toLowerCase()) || t.email?.includes(search) || t.cr_number?.includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { active: "bg-emerald-100 text-emerald-700", suspended: "bg-destructive/10 text-destructive", inactive: "bg-muted text-muted-foreground" };
    const labels: Record<string, string> = { active: "نشط", suspended: "معلق", inactive: "غير نشط" };
    return <Badge className={map[status] || map.active}>{labels[status] || status}</Badge>;
  };

  const invoiceStatusBadge = (status: string) => {
    const map: Record<string, string> = { draft: "bg-muted text-muted-foreground", sent: "bg-blue-100 text-blue-700", paid: "bg-emerald-100 text-emerald-700", cancelled: "bg-destructive/10 text-destructive", overdue: "bg-amber-100 text-amber-700" };
    const labels: Record<string, string> = { draft: "مسودة", sent: "مرسلة", paid: "مدفوعة", cancelled: "ملغية", overdue: "متأخرة" };
    return <Badge className={map[status] || ""}>{labels[status] || status}</Badge>;
  };

  const ROLE_LABELS: Record<string, string> = { owner: "مالك", admin: "مدير", manager: "مدير قسم", hr: "موارد بشرية", accountant: "محاسب", member: "موظف" };

  const activeCount = tenants.filter((t) => t.status === "active").length;
  const suspendedCount = tenants.filter((t) => t.status === "suspended").length;

  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة الشركات</h1>
          <p className="text-sm text-muted-foreground">جميع الشركات المسجلة في المنصة</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1 bg-emerald-50">{activeCount} نشط</Badge>
          <Badge variant="outline" className="gap-1 bg-destructive/5">{suspendedCount} معلق</Badge>
          <Badge variant="outline" className="gap-1"><Building2 size={14} /> {tenants.length} شركة</Badge>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-accent/10 p-2"><Building2 size={20} className="text-accent" /></div><div><p className="text-2xl font-bold">{tenants.length}</p><p className="text-xs text-muted-foreground">إجمالي الشركات</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-blue-100 p-2"><UsersIcon size={20} className="text-blue-600" /></div><div><p className="text-2xl font-bold">{Object.values(memberCount).reduce((a, b) => a + b, 0)}</p><p className="text-xs text-muted-foreground">إجمالي الأعضاء</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-violet-100 p-2"><FileText size={20} className="text-violet-600" /></div><div><p className="text-2xl font-bold">{Object.values(invoiceCount).reduce((a, b) => a + b, 0)}</p><p className="text-xs text-muted-foreground">إجمالي الفواتير</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-amber-100 p-2"><CreditCard size={20} className="text-amber-600" /></div><div><p className="text-2xl font-bold">{Object.values(contractCount).reduce((a, b) => a + b, 0)}</p><p className="text-xs text-muted-foreground">إجمالي العقود</p></div></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="ابحث بالاسم أو البريد أو السجل التجاري..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="suspended">معلق</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
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
                  <TableHead className="text-right">الشركة</TableHead>
                  <TableHead className="text-right">المدينة</TableHead>
                  <TableHead className="text-right">الأعضاء</TableHead>
                  <TableHead className="text-right">الفواتير</TableHead>
                  <TableHead className="text-right">العقود</TableHead>
                  <TableHead className="text-right">ZATCA</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تاريخ التسجيل</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openDetail(t)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{t.name}</p>
                        {t.name_en && <p className="text-[11px] text-muted-foreground">{t.name_en}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.address_city || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{memberCount[t.id] || 0}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{invoiceCount[t.id] || 0}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{contractCount[t.id] || 0}</Badge></TableCell>
                    <TableCell>{t.zatca_phase1_enabled ? <Badge className="bg-emerald-100 text-emerald-700">مفعل</Badge> : <Badge variant="outline">غير مفعل</Badge>}</TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(t.created_at).toLocaleDateString("ar-SA")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => openDetail(t)}><Eye size={16} /></Button>
                        <Button size="sm" variant={t.status === "active" ? "destructive" : "default"} onClick={() => toggleStatus(t)}>
                          {t.status === "active" ? "تعليق" : "تفعيل"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد شركات مطابقة</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent dir="rtl" className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 size={20} className="text-accent" />
              {selected?.name}
              {selected && statusBadge(selected.status)}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">معلومات الشركة</TabsTrigger>
              <TabsTrigger value="members" className="flex-1">الأعضاء ({detailMembers.length})</TabsTrigger>
              <TabsTrigger value="invoices" className="flex-1">الفواتير ({detailInvoices.length})</TabsTrigger>
              <TabsTrigger value="contracts" className="flex-1">العقود ({detailContracts.length})</TabsTrigger>
            </TabsList>

            {detailLoading ? (
              <div className="flex justify-center p-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>
            ) : (
              <>
                <TabsContent value="info">
                  {selected && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <InfoRow label="الاسم" value={selected.name} />
                      <InfoRow label="الاسم (EN)" value={selected.name_en} />
                      <InfoRow label="البريد" value={selected.email} />
                      <InfoRow label="الهاتف" value={selected.phone} />
                      <InfoRow label="السجل التجاري" value={selected.cr_number} />
                      <InfoRow label="الرقم الضريبي" value={selected.vat_number} />
                      <InfoRow label="المدينة" value={selected.address_city} />
                      <InfoRow label="القطاع" value={selected.industry} />
                      <InfoRow label="مسجل بالضريبة" value={selected.vat_registered ? "نعم ✅" : "لا"} />
                      <InfoRow label="ZATCA" value={selected.zatca_phase1_enabled ? "المرحلة الأولى مفعلة ✅" : "غير مفعل"} />
                      <InfoRow label="تاريخ التسجيل" value={new Date(selected.created_at).toLocaleDateString("ar-SA")} />
                      <InfoRow label="عدد الأعضاء" value={String(memberCount[selected.id] || 0)} />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="members">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">البريد</TableHead>
                      <TableHead className="text-right">الدور</TableHead>
                      <TableHead className="text-right">تاريخ الانضمام</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {detailMembers.map((m) => (
                        <TableRow key={m.user_id}>
                          <TableCell className="font-medium">{m.full_name}</TableCell>
                          <TableCell className="text-muted-foreground">{m.email}</TableCell>
                          <TableCell><Badge variant="secondary">{ROLE_LABELS[m.role] || m.role}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-xs">{new Date(m.joined_at).toLocaleDateString("ar-SA")}</TableCell>
                        </TableRow>
                      ))}
                      {detailMembers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">لا يوجد أعضاء</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="invoices">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-right">رقم الفاتورة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {detailInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString("ar-SA")}</TableCell>
                          <TableCell>{inv.grand_total.toLocaleString("ar-SA")} ر.س</TableCell>
                          <TableCell>{invoiceStatusBadge(inv.status)}</TableCell>
                        </TableRow>
                      ))}
                      {detailInvoices.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">لا توجد فواتير</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="contracts">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-right">رقم العقد</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">القيمة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {detailContracts.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.contract_number}</TableCell>
                          <TableCell className="text-muted-foreground">{c.title}</TableCell>
                          <TableCell>{c.total_value.toLocaleString("ar-SA")} ر.س</TableCell>
                          <TableCell>{statusBadge(c.status)}</TableCell>
                        </TableRow>
                      ))}
                      {detailContracts.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">لا توجد عقود</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TabsContent>
              </>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="rounded-lg border p-3">
    <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
    <p className="font-medium">{value || "—"}</p>
  </div>
);

export default AdminCompanies;
