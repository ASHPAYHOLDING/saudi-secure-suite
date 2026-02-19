import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building, Plus, Save, Loader2, Trash2, MapPin, Users, Palette, Shield, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/useLanguage";
import type { Branch } from "@/contexts/BranchContext";

interface BranchMember {
  id: string;
  user_id: string;
  branch_id: string;
  profile?: { full_name: string; email: string };
}

interface ExtendedBranch extends Branch {
  branch_color?: string;
}

const DEFAULT_COLORS = [
  "#0f4c81", "#1a9b8a", "#e74c3c", "#f39c12", "#8e44ad", "#2c3e50", "#27ae60", "#d35400"
];

const BranchManagement = () => {
  const { tenantId, user } = useAuth();
  const { branches, refetch, isAdmin } = useBranch();
  const { t, currentLang } = useLanguage();
  const [allBranches, setAllBranches] = useState<ExtendedBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<ExtendedBranch | null>(null);
  const [members, setMembers] = useState<BranchMember[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: "", name_en: "", code: "", address_city: "", phone: "", email: "", branch_color: "#0f4c81" });

  useEffect(() => {
    if (tenantId) fetchAll();
  }, [tenantId]);

  // Realtime subscription for instant branch updates
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`branches-mgmt-${tenantId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "branches",
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload: any) => {
        if (payload.eventType === "UPDATE") {
          setAllBranches(prev => prev.map(b => b.id === payload.new.id ? { ...b, ...payload.new } as ExtendedBranch : b));
          if (selectedBranch?.id === payload.new.id) {
            setSelectedBranch(prev => prev ? { ...prev, ...payload.new } as ExtendedBranch : null);
          }
        } else {
          fetchAll();
        }
        refetch(); // Invalidate cached branch access instantly
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, selectedBranch?.id]);

  const fetchAll = async () => {
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("tenant_id", tenantId!)
      .order("is_main", { ascending: false })
      .order("created_at", { ascending: true });
    if (data) setAllBranches(data as ExtendedBranch[]);
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

    const { data: team } = await supabase
      .from("tenant_members")
      .select("user_id, role")
      .eq("tenant_id", tenantId!);
    
    if (team) {
      const teamIds = team.map((t: any) => t.user_id);
      const { data: teamProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", teamIds);
      const merged = (teamProfiles || []).map((p: any) => ({
        ...p,
        role: team.find((t: any) => t.user_id === p.id)?.role || "member",
      }));
      setTeamMembers(merged);
    }
  };

  const selectBranch = (branch: ExtendedBranch) => {
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
      branch_color: newBranch.branch_color || "#0f4c81",
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(currentLang === "ar" ? "تم إنشاء الفرع بنجاح" : "Branch created successfully");
      setShowCreate(false);
      setNewBranch({ name: "", name_en: "", code: "", address_city: "", phone: "", email: "", branch_color: "#0f4c81" });
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
        manager_id: selectedBranch.manager_id,
        branch_color: (selectedBranch as any).branch_color || "#0f4c81",
      } as any)
      .eq("id", selectedBranch.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(currentLang === "ar" ? "تم تحديث الفرع" : "Branch updated");
      fetchAll();
      refetch();
    }
  };

  // Realtime toggle: update is_active instantly
  const handleToggleActive = async (branch: ExtendedBranch) => {
    if (!isAdmin) {
      toast.error(currentLang === "ar" ? "ليس لديك صلاحية لتغيير حالة الفرع" : "No permission to toggle branch status");
      return;
    }
    if (branch.is_main) return;

    setTogglingId(branch.id);
    const newActive = !branch.is_active;
    
    const { error } = await supabase
      .from("branches")
      .update({ is_active: newActive })
      .eq("id", branch.id);

    setTogglingId(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        currentLang === "ar"
          ? `تم ${newActive ? "تفعيل" : "تعطيل"} الفرع: ${branch.name}`
          : `Branch ${newActive ? "activated" : "deactivated"}: ${branch.name}`
      );
      // Realtime subscription handles UI update + refetch invalidates cache
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!isAdmin) {
      toast.error(currentLang === "ar" ? "ليس لديك صلاحية" : "No permission");
      return;
    }
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
    if (!isAdmin) {
      toast.error(currentLang === "ar" ? "ليس لديك صلاحية" : "No permission");
      return;
    }
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
    if (!isAdmin) {
      toast.error(currentLang === "ar" ? "ليس لديك صلاحية" : "No permission");
      return;
    }
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
          {!isAdmin && (
            <Badge variant="secondary" className="text-[10px]">
              <Shield className="h-3 w-3 mr-1" />
              {isRTL ? "عرض فقط" : "View Only"}
            </Badge>
          )}
        </div>
        {isAdmin && (
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
                {/* Branch Color */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" />{isRTL ? "لون الفرع" : "Branch Color"}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newBranch.branch_color}
                      onChange={(e) => setNewBranch({ ...newBranch, branch_color: e.target.value })}
                      className="h-9 w-12 rounded border border-border cursor-pointer"
                    />
                    <div className="flex gap-1">
                      {DEFAULT_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewBranch({ ...newBranch, branch_color: c })}
                          className={`h-7 w-7 rounded-full border-2 transition-all ${newBranch.branch_color === c ? "border-foreground scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isRTL ? "إنشاء الفرع" : "Create Branch"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
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
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                      style={{ backgroundColor: `${(branch as any).branch_color || '#0f4c81'}20` }}
                    >
                      <MapPin className="h-5 w-5" style={{ color: (branch as any).branch_color || '#0f4c81' }} />
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
                    {branch.code && (
                      <Badge variant="outline" className="text-[10px] font-mono">{branch.code}</Badge>
                    )}
                    {/* Realtime activation toggle */}
                    {isAdmin && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={branch.is_active}
                          onCheckedChange={() => handleToggleActive(branch)}
                          disabled={branch.is_main || togglingId === branch.id}
                          className="scale-75"
                        />
                      </div>
                    )}
                    {!branch.is_active && (
                      <Badge variant="destructive" className="text-[10px]">{isRTL ? "معطّل" : "Inactive"}</Badge>
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
                  <div
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: (selectedBranch as any).branch_color || '#0f4c81' }}
                  />
                  {isRTL ? "تفاصيل الفرع" : "Branch Details"}
                </CardTitle>
                {isAdmin && !selectedBranch.is_main && (
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteBranch(selectedBranch.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                    <Input value={selectedBranch.name} onChange={(e) => setSelectedBranch({ ...selectedBranch, name: e.target.value })} disabled={!isAdmin} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                    <Input value={selectedBranch.name_en || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, name_en: e.target.value })} dir="ltr" disabled={!isAdmin} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الرمز" : "Code"}</Label>
                    <Input value={selectedBranch.code || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, code: e.target.value })} dir="ltr" disabled={!isAdmin} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "المدينة" : "City"}</Label>
                    <Input value={selectedBranch.address_city || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, address_city: e.target.value })} disabled={!isAdmin} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الشارع" : "Street"}</Label>
                    <Input value={selectedBranch.address_street || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, address_street: e.target.value })} disabled={!isAdmin} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الرمز البريدي" : "ZIP"}</Label>
                    <Input value={selectedBranch.address_zip || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, address_zip: e.target.value })} dir="ltr" disabled={!isAdmin} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الهاتف" : "Phone"}</Label>
                    <Input value={selectedBranch.phone || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, phone: e.target.value })} dir="ltr" disabled={!isAdmin} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "البريد" : "Email"}</Label>
                    <Input value={selectedBranch.email || ""} onChange={(e) => setSelectedBranch({ ...selectedBranch, email: e.target.value })} dir="ltr" disabled={!isAdmin} />
                  </div>
                </div>

                {/* Manager Selection */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {isRTL ? "مدير الفرع" : "Branch Manager"}
                  </Label>
                  <Select
                    value={selectedBranch.manager_id || "none"}
                    onValueChange={(v) => setSelectedBranch({ ...selectedBranch, manager_id: v === "none" ? null : v })}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? "اختر مديراً" : "Select manager"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{isRTL ? "— بدون مدير —" : "— No Manager —"}</SelectItem>
                      {teamMembers.map((tm) => (
                        <SelectItem key={tm.id} value={tm.id}>
                          {tm.full_name || tm.email}
                          {tm.role && <span className="text-muted-foreground"> ({tm.role})</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Branch Color */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5" />
                    {isRTL ? "لون الفرع" : "Branch Color"}
                  </Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={(selectedBranch as any).branch_color || "#0f4c81"}
                      onChange={(e) => setSelectedBranch({ ...selectedBranch, branch_color: e.target.value } as any)}
                      className="h-9 w-12 rounded border border-border cursor-pointer"
                      disabled={!isAdmin}
                    />
                    <div className="flex gap-1.5">
                      {DEFAULT_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => isAdmin && setSelectedBranch({ ...selectedBranch, branch_color: c } as any)}
                          className={`h-7 w-7 rounded-full border-2 transition-all ${(selectedBranch as any).branch_color === c ? "border-foreground scale-110" : "border-transparent"} ${!isAdmin ? 'cursor-not-allowed opacity-50' : ''}`}
                          style={{ backgroundColor: c }}
                          disabled={!isAdmin}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <Switch
                    checked={selectedBranch.is_active}
                    onCheckedChange={(checked) => setSelectedBranch({ ...selectedBranch, is_active: checked })}
                    disabled={selectedBranch.is_main || !isAdmin}
                  />
                  <Label className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    {isRTL ? "فرع نشط" : "Active Branch"}
                  </Label>
                  {selectedBranch.is_main && (
                    <span className="text-[10px] text-muted-foreground">{isRTL ? "(الفرع الرئيسي لا يمكن تعطيله)" : "(HQ cannot be deactivated)"}</span>
                  )}
                </div>

                {isAdmin && (
                  <Button onClick={handleUpdateBranch} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                    {isRTL ? "حفظ التعديلات" : "Save Changes"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Branch Members / Permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  {isRTL ? "صلاحيات الفرع" : "Branch Permissions"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {isRTL
                    ? "الأعضاء المُعيّنون لهذا الفرع يستطيعون فقط الوصول لبيانات هذا الفرع. المدراء والمالكون يمكنهم الوصول لجميع الفروع."
                    : "Members assigned to this branch can only access its data. Admins and owners have access to all branches."
                  }
                </p>

                {/* Current members */}
                {members.length > 0 ? (
                  <div className="space-y-2">
                    {members.map((m) => {
                      const memberInfo = teamMembers.find(t => t.id === m.user_id);
                      const isManager = selectedBranch.manager_id === m.user_id;
                      return (
                        <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ backgroundColor: (selectedBranch as any).branch_color || '#0f4c81' }}
                            >
                              {(m.profile?.full_name || "?")[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{m.profile?.full_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{m.profile?.email || ""}</p>
                            </div>
                            {isManager && (
                              <Badge variant="outline" className="text-[10px]">{isRTL ? "مدير" : "Manager"}</Badge>
                            )}
                            {memberInfo?.role && (
                              <Badge variant="secondary" className="text-[10px]">{memberInfo.role}</Badge>
                            )}
                          </div>
                          {isAdmin && (
                            <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{isRTL ? "لا يوجد أعضاء في هذا الفرع" : "No members assigned"}</p>
                )}

                {/* Assign new member */}
                {isAdmin && teamMembers.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm font-medium mb-2">{isRTL ? "إضافة عضو:" : "Add member:"}</p>
                    <div className="flex flex-wrap gap-2">
                      {teamMembers
                        .filter((tm) => !members.some((m) => m.user_id === tm.id))
                        .map((tm) => (
                          <Button key={tm.id} variant="outline" size="sm" onClick={() => assignMember(tm.id)}>
                            <Plus className="h-3 w-3 ml-1" />
                            {tm.full_name || tm.email}
                            {tm.role && <span className="text-muted-foreground text-[10px] ml-1">({tm.role})</span>}
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
