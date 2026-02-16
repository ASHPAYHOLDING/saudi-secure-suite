import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Building, Plus, Save, Loader2, Trash2, MapPin, Users, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/useLanguage";
import type { Branch } from "@/contexts/BranchContext";

interface BranchMember {
  id: string;
  user_id: string;
  branch_id: string;
  profile?: { full_name: string; email: string };
}

const BranchManagement = () => {
  const { tenantId, user } = useAuth();
  const { branches, refetch } = useBranch();
  const { t, currentLang } = useLanguage();
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [members, setMembers] = useState<BranchMember[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: "", name_en: "", code: "", address_city: "", phone: "", email: "" });

  useEffect(() => {
    if (tenantId) fetchAll();
  }, [tenantId]);

  const fetchAll = async () => {
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("tenant_id", tenantId!)
      .order("is_main", { ascending: false })
      .order("created_at", { ascending: true });
    if (data) setAllBranches(data as Branch[]);
  };

  const fetchMembers = async (branchId: string) => {
    const { data } = await supabase
      .from("branch_members")
      .select("id, user_id, branch_id")
      .eq("branch_id", branchId)
      .eq("tenant_id", tenantId!);
    
    if (data && data.length > 0) {
      const userIds = data.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      const merged = data.map((m: any) => ({
        ...m,
        profile: profiles?.find((p: any) => p.id === m.user_id),
      }));
      setMembers(merged);
    } else {
      setMembers([]);
    }

    // Fetch all team members for assignment
    const { data: team } = await supabase
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", tenantId!);
    
    if (team) {
      const teamIds = team.map((t: any) => t.user_id);
      const { data: teamProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", teamIds);
      setTeamMembers(teamProfiles || []);
    }
  };

  const selectBranch = (branch: Branch) => {
    setSelectedBranch(branch);
    fetchMembers(branch.id);
  };

  const handleCreate = async () => {
    if (!tenantId || !user || !newBranch.name.trim()) {
      toast.error(currentLang === "ar" ? "يرجى إدخال اسم الفرع" : "Please enter branch name");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("branches").insert({
      tenant_id: tenantId,
      name: newBranch.name,
      name_en: newBranch.name_en || null,
      code: newBranch.code || null,
      address_city: newBranch.address_city || null,
      phone: newBranch.phone || null,
      email: newBranch.email || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(currentLang === "ar" ? "تم إنشاء الفرع بنجاح" : "Branch created successfully");
      setShowCreate(false);
      setNewBranch({ name: "", name_en: "", code: "", address_city: "", phone: "", email: "" });
      fetchAll();
      refetch();
    }
  };

  const handleUpdateBranch = async () => {
    if (!selectedBranch) return;
    setSaving(true);
    const { error } = await supabase
      .from("branches")
      .update({
        name: selectedBranch.name,
        name_en: selectedBranch.name_en,
        code: selectedBranch.code,
        address_city: selectedBranch.address_city,
        address_street: selectedBranch.address_street,
        address_zip: selectedBranch.address_zip,
        phone: selectedBranch.phone,
        email: selectedBranch.email,
        is_active: selectedBranch.is_active,
      })
      .eq("id", selectedBranch.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(currentLang === "ar" ? "تم تحديث الفرع" : "Branch updated");
      fetchAll();
      refetch();
    }
  };

  const handleDeleteBranch = async (id: string) => {
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(currentLang === "ar" ? "تم حذف الفرع" : "Branch deleted");
      setSelectedBranch(null);
      fetchAll();
      refetch();
    }
  };

  const assignMember = async (userId: string) => {
    if (!selectedBranch || !tenantId) return;
    const { error } = await supabase.from("branch_members").insert({
      branch_id: selectedBranch.id,
      user_id: userId,
      tenant_id: tenantId,
      assigned_by: user?.id,
    });
    if (error) {
      if (error.code === "23505") toast.error(currentLang === "ar" ? "العضو مضاف مسبقاً" : "Already assigned");
      else toast.error(error.message);
    } else {
      toast.success(currentLang === "ar" ? "تمت إضافة العضو" : "Member assigned");
      fetchMembers(selectedBranch.id);
    }
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("branch_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else {
      toast.success(currentLang === "ar" ? "تمت إزالة العضو" : "Member removed");
      if (selectedBranch) fetchMembers(selectedBranch.id);
    }
  };

  const isRTL = currentLang === "ar";

  return (
    <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {isRTL ? "إدارة الفروع" : "Branch Management"}
          </h1>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{isRTL ? "فرع جديد" : "New Branch"}</Button>
          </DialogTrigger>
          <DialogContent dir={isRTL ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle>{isRTL ? "إنشاء فرع جديد" : "Create New Branch"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? "اسم الفرع (عربي) *" : "Branch Name (Arabic) *"}</Label>
                  <Input value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "اسم الفرع (إنجليزي)" : "Branch Name (English)"}</Label>
                  <Input value={newBranch.name_en} onChange={(e) => setNewBranch({ ...newBranch, name_en: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "رمز الفرع" : "Branch Code"}</Label>
                  <Input value={newBranch.code} onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })} placeholder="e.g. RYD" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "المدينة" : "City"}</Label>
                  <Input value={newBranch.address_city} onChange={(e) => setNewBranch({ ...newBranch, address_city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "الهاتف" : "Phone"}</Label>
                  <Input value={newBranch.phone} onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "البريد الإلكتروني" : "Email"}</Label>
                  <Input value={newBranch.email} onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })} dir="ltr" />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isRTL ? "إنشاء الفرع" : "Create Branch"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branch list */}
        <div className="space-y-3">
          {allBranches.map((branch) => (
            <Card
              key={branch.id}
              className={`cursor-pointer transition-all hover:shadow-md ${selectedBranch?.id === branch.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => selectBranch(branch)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{branch.name}</p>
                      {branch.name_en && <p className="text-xs text-muted-foreground">{branch.name_en}</p>}
                      {branch.address_city && <p className="text-xs text-muted-foreground">{branch.address_city}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {branch.is_main && (
                      <Badge variant="default" className="text-[10px]">{isRTL ? "رئيسي" : "HQ"}</Badge>
                    )}
                    {!branch.is_active && (
                      <Badge variant="destructive" className="text-[10px]">{isRTL ? "معطّل" : "Inactive"}</Badge>
                    )}
                    {branch.code && (
                      <Badge variant="outline" className="text-[10px] font-mono">{branch.code}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Branch details */}
        {selectedBranch ? (
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  {isRTL ? "تفاصيل الفرع" : "Branch Details"}
                </CardTitle>
                {!selectedBranch.is_main && (
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteBranch(selectedBranch.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                    <Input value={selectedBranch.name} onChange={(e) => setSelectedBranch({ ...selectedBranch, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                    <Input value={selectedBranch.name_en || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, name_en: e.target.value })} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الرمز" : "Code"}</Label>
                    <Input value={selectedBranch.code || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, code: e.target.value })} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "المدينة" : "City"}</Label>
                    <Input value={selectedBranch.address_city || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, address_city: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الشارع" : "Street"}</Label>
                    <Input value={selectedBranch.address_street || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, address_street: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الرمز البريدي" : "ZIP"}</Label>
                    <Input value={selectedBranch.address_zip || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, address_zip: e.target.value })} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الهاتف" : "Phone"}</Label>
                    <Input value={selectedBranch.phone || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, phone: e.target.value })} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "البريد" : "Email"}</Label>
                    <Input value={selectedBranch.email || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, email: e.target.value })} dir="ltr" />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    checked={selectedBranch.is_active}
                    onCheckedChange={(checked) => setSelectedBranch({ ...selectedBranch, is_active: checked })}
                    disabled={selectedBranch.is_main}
                  />
                  <Label>{isRTL ? "فرع نشط" : "Active Branch"}</Label>
                </div>
                <Button onClick={handleUpdateBranch} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                  {isRTL ? "حفظ التعديلات" : "Save Changes"}
                </Button>
              </CardContent>
            </Card>

            {/* Branch Members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {isRTL ? "أعضاء الفرع" : "Branch Members"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current members */}
                {members.length > 0 ? (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">{m.profile?.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{m.profile?.email || ""}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{isRTL ? "لا يوجد أعضاء في هذا الفرع" : "No members assigned"}</p>
                )}

                {/* Assign new member */}
                {teamMembers.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-2">{isRTL ? "إضافة عضو:" : "Add member:"}</p>
                    <div className="flex flex-wrap gap-2">
                      {teamMembers
                        .filter((tm) => !members.some((m) => m.user_id === tm.id))
                        .map((tm) => (
                          <Button key={tm.id} variant="outline" size="sm" onClick={() => assignMember(tm.id)}>
                            <Plus className="h-3 w-3 ml-1" />
                            {tm.full_name || tm.email}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center text-muted-foreground p-12">
            <div className="text-center space-y-2">
              <Building className="h-12 w-12 mx-auto opacity-30" />
              <p>{isRTL ? "اختر فرعاً لعرض التفاصيل" : "Select a branch to view details"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchManagement;
