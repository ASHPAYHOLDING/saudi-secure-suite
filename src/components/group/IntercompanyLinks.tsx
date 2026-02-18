import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Link2, Plus, Trash2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  parentTenantId: string;
}

interface ICLink {
  id: string;
  tenant_id: string;
  linked_tenant_id: string;
  link_type: string;
  is_active: boolean;
  created_at: string;
  tenant_name?: string;
  linked_tenant_name?: string;
}

const IntercompanyLinks = ({ parentTenantId }: Props) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [links, setLinks] = useState<ICLink[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [fromTenant, setFromTenant] = useState("");
  const [toTenant, setToTenant] = useState("");

  const fetchData = async () => {
    setLoading(true);

    // Fetch subsidiaries
    const { data: subs } = await supabase.rpc("get_group_subsidiaries", {
      _parent_tenant_id: parentTenantId,
    });

    const allCompanies = [
      ...(subs || []).map((s: any) => ({ id: s.id, name: s.name })),
    ];

    // Also add parent tenant
    const { data: parent } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", parentTenantId)
      .single();

    if (parent) allCompanies.unshift({ id: parent.id, name: parent.name });
    setSubsidiaries(allCompanies);

    // Fetch links
    const { data: linkData } = await supabase
      .from("intercompany_links")
      .select("*")
      .eq("parent_tenant_id", parentTenantId)
      .order("created_at", { ascending: false });

    if (linkData) {
      // Enrich with names
      const enriched = linkData.map((l: any) => ({
        ...l,
        tenant_name: allCompanies.find((c) => c.id === l.tenant_id)?.name || l.tenant_id,
        linked_tenant_name: allCompanies.find((c) => c.id === l.linked_tenant_id)?.name || l.linked_tenant_id,
      }));
      setLinks(enriched);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [parentTenantId]);

  const handleAdd = async () => {
    if (!fromTenant || !toTenant || fromTenant === toTenant) {
      toast.error(isRTL ? "اختر شركتين مختلفتين" : "Select two different companies");
      return;
    }

    const { error } = await supabase.from("intercompany_links").insert({
      parent_tenant_id: parentTenantId,
      tenant_id: fromTenant,
      linked_tenant_id: toTenant,
      link_type: "manual",
      created_by: user?.id,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error(isRTL ? "الرابط موجود مسبقاً" : "Link already exists");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(isRTL ? "تم إنشاء الرابط" : "Link created");
      setAddOpen(false);
      setFromTenant("");
      setToTenant("");
      fetchData();
    }
  };

  const handleToggle = async (linkId: string, active: boolean) => {
    await supabase
      .from("intercompany_links")
      .update({ is_active: active })
      .eq("id", linkId);
    fetchData();
  };

  const handleDelete = async (linkId: string) => {
    await supabase.from("intercompany_links").delete().eq("id", linkId);
    toast.success(isRTL ? "تم الحذف" : "Deleted");
    fetchData();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Link2 size={20} />
          {isRTL ? "الروابط البينية" : "Intercompany Links"}
          <Badge variant="secondary">{links.length}</Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw size={14} />
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus size={14} />
                {isRTL ? "إضافة رابط" : "Add Link"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isRTL ? "إضافة رابط بيني" : "Add Intercompany Link"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>{isRTL ? "الشركة الأولى" : "Company A"}</Label>
                  <Select value={fromTenant} onValueChange={setFromTenant}>
                    <SelectTrigger><SelectValue placeholder={isRTL ? "اختر..." : "Select..."} /></SelectTrigger>
                    <SelectContent>
                      {subsidiaries.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isRTL ? "الشركة الثانية" : "Company B"}</Label>
                  <Select value={toTenant} onValueChange={setToTenant}>
                    <SelectTrigger><SelectValue placeholder={isRTL ? "اختر..." : "Select..."} /></SelectTrigger>
                    <SelectContent>
                      {subsidiaries.filter((s) => s.id !== fromTenant).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} className="w-full">
                  {isRTL ? "إضافة" : "Add"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p>{isRTL ? "لا توجد روابط بينية بعد" : "No intercompany links yet"}</p>
            <p className="text-sm mt-1">
              {isRTL
                ? "أضف روابط بين الشركات التابعة لإزالة العمليات البينية من التقارير الموحدة"
                : "Add links between subsidiaries to eliminate intercompany transactions from consolidated reports"}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "الشركة الأولى" : "Company A"}</TableHead>
                  <TableHead className="text-center">↔</TableHead>
                  <TableHead>{isRTL ? "الشركة الثانية" : "Company B"}</TableHead>
                  <TableHead>{isRTL ? "النوع" : "Type"}</TableHead>
                  <TableHead>{isRTL ? "مفعّل" : "Active"}</TableHead>
                  <TableHead>{isRTL ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.tenant_name}</TableCell>
                    <TableCell className="text-center text-muted-foreground">⟷</TableCell>
                    <TableCell className="font-medium">{link.linked_tenant_name}</TableCell>
                    <TableCell>
                      <Badge variant={link.link_type === "auto" ? "default" : "outline"}>
                        {link.link_type === "auto" ? (isRTL ? "تلقائي" : "Auto") : (isRTL ? "يدوي" : "Manual")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={link.is_active}
                        onCheckedChange={(val) => handleToggle(link.id, val)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(link.id)}>
                        <Trash2 size={14} className="text-destructive" />
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

export default IntercompanyLinks;
