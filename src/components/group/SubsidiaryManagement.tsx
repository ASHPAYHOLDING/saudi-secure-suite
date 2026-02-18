import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SubsidiaryManagementProps {
  parentTenantId: string;
}

interface Subsidiary {
  id: string;
  name: string;
  name_en: string | null;
  status: string;
  cr_number: string | null;
  vat_number: string | null;
  industry: string | null;
  created_at: string;
}

const SubsidiaryManagement = ({ parentTenantId }: SubsidiaryManagementProps) => {
  const { isRTL } = useLanguage();
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSlug, setLinkSlug] = useState("");

  const fetchSubsidiaries = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_group_subsidiaries", {
      _parent_tenant_id: parentTenantId,
    });
    if (data) setSubsidiaries(data as Subsidiary[]);
    if (error) toast.error(error.message);
    setLoading(false);
  };

  useEffect(() => {
    fetchSubsidiaries();
  }, [parentTenantId]);

  const handleLinkSubsidiary = async () => {
    if (!linkSlug.trim()) return;

    // Find tenant by slug or name
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name")
      .or(`slug.eq.${linkSlug.trim()},name.eq.${linkSlug.trim()}`)
      .maybeSingle();

    if (!tenant) {
      toast.error(isRTL ? "لم يتم العثور على الشركة" : "Company not found");
      return;
    }

    const { error } = await supabase
      .from("tenants")
      .update({ parent_tenant_id: parentTenantId })
      .eq("id", tenant.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? "تمت إضافة الشركة التابعة" : "Subsidiary linked");
      setLinkOpen(false);
      setLinkSlug("");
      fetchSubsidiaries();
    }
  };

  const handleUnlink = async (subId: string) => {
    const { error } = await supabase
      .from("tenants")
      .update({ parent_tenant_id: null })
      .eq("id", subId);

    if (error) toast.error(error.message);
    else {
      toast.success(isRTL ? "تم فك الربط" : "Subsidiary unlinked");
      fetchSubsidiaries();
    }
  };

  const filtered = subsidiaries.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.name_en || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Building2 size={20} />
          {isRTL ? "الشركات التابعة" : "Subsidiaries"}
          <Badge variant="secondary">{subsidiaries.length}</Badge>
        </CardTitle>
        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus size={14} />
              {isRTL ? "ربط شركة" : "Link Company"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? "ربط شركة تابعة" : "Link Subsidiary"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>{isRTL ? "اسم أو معرّف الشركة" : "Company name or slug"}</Label>
                <Input
                  value={linkSlug}
                  onChange={(e) => setLinkSlug(e.target.value)}
                  placeholder={isRTL ? "أدخل اسم الشركة..." : "Enter company name..."}
                />
              </div>
              <Button onClick={handleLinkSubsidiary} className="w-full">
                {isRTL ? "ربط" : "Link"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder={isRTL ? "بحث..." : "Search..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {isRTL ? "لا توجد شركات تابعة" : "No subsidiaries found"}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "الاسم" : "Name"}</TableHead>
                  <TableHead>{isRTL ? "السجل التجاري" : "CR Number"}</TableHead>
                  <TableHead>{isRTL ? "الرقم الضريبي" : "VAT Number"}</TableHead>
                  <TableHead>{isRTL ? "القطاع" : "Industry"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isRTL ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      <div>{sub.name}</div>
                      {sub.name_en && <div className="text-xs text-muted-foreground">{sub.name_en}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{sub.cr_number || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{sub.vat_number || "—"}</TableCell>
                    <TableCell>{sub.industry || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                        {sub.status === "active" ? (isRTL ? "نشط" : "Active") : sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnlink(sub.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        {isRTL ? "فك الربط" : "Unlink"}
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
  );
};

export default SubsidiaryManagement;
