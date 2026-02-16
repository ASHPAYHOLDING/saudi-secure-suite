import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Shield, Plus, Save, Eye, Trash2, Copy, FileText, Lock, Pencil } from "lucide-react";

interface PermissionDef {
  key: string;
  category: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
}

interface CustomRole {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  color: string;
  is_system: boolean;
  base_role: string | null;
}

interface RolePermission {
  role_id: string;
  permission_key: string;
}

const CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  invoices: { ar: "الفواتير", en: "Invoices" },
  expenses: { ar: "المصروفات", en: "Expenses" },
  customers: { ar: "العملاء", en: "Customers" },
  suppliers: { ar: "الموردين", en: "Suppliers" },
  contracts: { ar: "العقود", en: "Contracts" },
  quotations: { ar: "عروض الأسعار", en: "Quotations" },
  sales_orders: { ar: "أوامر البيع", en: "Sales Orders" },
  purchase_orders: { ar: "أوامر الشراء", en: "Purchase Orders" },
  inventory: { ar: "المخزون", en: "Inventory" },
  finance: { ar: "المالية والتقارير", en: "Finance & Reports" },
  team: { ar: "الفريق", en: "Team" },
  settings: { ar: "الإعدادات", en: "Settings" },
  branches: { ar: "الفروع", en: "Branches" },
  audit: { ar: "التدقيق", en: "Audit" },
  subscription: { ar: "الاشتراك", en: "Subscription" },
};

const PermissionsManagement = () => {
  const { tenantId, user } = useAuth();
  const { t, isRTL } = useLanguage();
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleNameAr, setNewRoleNameAr] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateNameAr, setTemplateNameAr] = useState("");
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; name_ar: string; permissions: string[] }>>([]);

  const lang = isRTL ? "ar" : "en";

  // Fetch data
  useEffect(() => {
    if (!tenantId) return;
    const fetchAll = async () => {
      setLoading(true);
      const [permsRes, rolesRes, rpRes, templatesRes] = await Promise.all([
        supabase.from("permission_definitions").select("*").order("sort_order"),
        supabase.from("custom_roles").select("*").eq("tenant_id", tenantId).order("is_system", { ascending: false }),
        supabase.from("role_permissions").select("role_id, permission_key").eq("tenant_id", tenantId),
        supabase.from("permission_templates").select("*").or(`tenant_id.eq.${tenantId},is_global.eq.true`),
      ]);
      setPermissions(permsRes.data ?? []);
      setRoles(rolesRes.data as CustomRole[] ?? []);
      setRolePermissions(rpRes.data ?? []);
      setTemplates(templatesRes.data?.map((t: any) => ({ id: t.id, name: t.name, name_ar: t.name_ar, permissions: t.permissions })) ?? []);
      setLoading(false);
    };
    fetchAll();
  }, [tenantId]);

  // When role selected, populate edited permissions
  useEffect(() => {
    if (!selectedRoleId) return;
    const currentPerms = rolePermissions
      .filter((rp) => rp.role_id === selectedRoleId)
      .map((rp) => rp.permission_key);
    setEditedPermissions(new Set(currentPerms));
    setHasChanges(false);
  }, [selectedRoleId, rolePermissions]);

  // Auto-select first role
  useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // Group permissions by category
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionDef[]> = {};
    permissions.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [permissions]);

  const originalPermissions = useMemo(() => {
    if (!selectedRoleId) return new Set<string>();
    return new Set(
      rolePermissions.filter((rp) => rp.role_id === selectedRoleId).map((rp) => rp.permission_key)
    );
  }, [selectedRoleId, rolePermissions]);

  const togglePermission = (key: string) => {
    setEditedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setHasChanges(true);
  };

  const toggleCategory = (category: string, checked: boolean) => {
    const categoryKeys = groupedPermissions[category]?.map((p) => p.key) ?? [];
    setEditedPermissions((prev) => {
      const next = new Set(prev);
      categoryKeys.forEach((k) => {
        if (checked) next.add(k);
        else next.delete(k);
      });
      return next;
    });
    setHasChanges(true);
  };

  const isCategoryFullyChecked = (category: string) =>
    groupedPermissions[category]?.every((p) => editedPermissions.has(p.key)) ?? false;

  const isCategoryPartiallyChecked = (category: string) => {
    const cat = groupedPermissions[category] ?? [];
    const checked = cat.filter((p) => editedPermissions.has(p.key)).length;
    return checked > 0 && checked < cat.length;
  };

  // Diff for preview
  const addedPermissions = useMemo(
    () => [...editedPermissions].filter((k) => !originalPermissions.has(k)),
    [editedPermissions, originalPermissions]
  );
  const removedPermissions = useMemo(
    () => [...originalPermissions].filter((k) => !editedPermissions.has(k)),
    [editedPermissions, originalPermissions]
  );

  const savePermissions = async () => {
    if (!selectedRoleId || !tenantId) return;
    setSaving(true);
    try {
      // Delete all current permissions for this role
      await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", selectedRoleId)
        .eq("tenant_id", tenantId);

      // Insert new permissions
      if (editedPermissions.size > 0) {
        const rows = [...editedPermissions].map((permission_key) => ({
          tenant_id: tenantId,
          role_id: selectedRoleId,
          permission_key,
        }));
        const { error } = await supabase.from("role_permissions").insert(rows);
        if (error) throw error;
      }

      // Update local state
      setRolePermissions((prev) => [
        ...prev.filter((rp) => rp.role_id !== selectedRoleId),
        ...[...editedPermissions].map((k) => ({ role_id: selectedRoleId, permission_key: k })),
      ]);
      setHasChanges(false);
      toast.success(isRTL ? "تم حفظ الصلاحيات بنجاح" : "Permissions saved successfully");
    } catch (err) {
      toast.error(isRTL ? "خطأ في حفظ الصلاحيات" : "Error saving permissions");
    }
    setSaving(false);
  };

  const createRole = async () => {
    if (!tenantId || !user || !newRoleName || !newRoleNameAr) return;
    try {
      const { data, error } = await supabase
        .from("custom_roles")
        .insert({
          tenant_id: tenantId,
          name: newRoleName,
          name_ar: newRoleNameAr,
          description: newRoleDesc,
          is_system: false,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      setRoles((prev) => [...prev, data as CustomRole]);
      setSelectedRoleId(data.id);
      setShowCreateRole(false);
      setNewRoleName("");
      setNewRoleNameAr("");
      setNewRoleDesc("");
      toast.success(isRTL ? "تم إنشاء الدور بنجاح" : "Role created successfully");
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!tenantId) return;
    try {
      await supabase.from("role_permissions").delete().eq("role_id", roleId).eq("tenant_id", tenantId);
      await supabase.from("custom_roles").delete().eq("id", roleId).eq("tenant_id", tenantId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (selectedRoleId === roleId) setSelectedRoleId(roles[0]?.id ?? null);
      toast.success(isRTL ? "تم حذف الدور" : "Role deleted");
    } catch {
      toast.error(isRTL ? "خطأ في حذف الدور" : "Error deleting role");
    }
  };

  const applyTemplate = (templatePerms: string[]) => {
    setEditedPermissions(new Set(templatePerms));
    setHasChanges(true);
    toast.info(isRTL ? "تم تطبيق القالب" : "Template applied");
  };

  const saveAsTemplate = async () => {
    if (!tenantId || !user || !templateName || !templateNameAr) return;
    try {
      const { error } = await supabase.from("permission_templates").insert({
        tenant_id: tenantId,
        name: templateName,
        name_ar: templateNameAr,
        permissions: [...editedPermissions],
        is_global: false,
        created_by: user.id,
      });
      if (error) throw error;
      setTemplates((prev) => [...prev, { id: crypto.randomUUID(), name: templateName, name_ar: templateNameAr, permissions: [...editedPermissions] }]);
      setShowCreateTemplate(false);
      setTemplateName("");
      setTemplateNameAr("");
      toast.success(isRTL ? "تم حفظ القالب" : "Template saved");
    } catch {
      toast.error(isRTL ? "خطأ في حفظ القالب" : "Error saving template");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? "إدارة الصلاحيات" : "Permissions Management"}</h1>
            <p className="text-sm text-muted-foreground">
              {isRTL ? `${permissions.length} صلاحية • ${roles.length} دور` : `${permissions.length} permissions • ${roles.length} roles`}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateRole(true)} size="sm">
          <Plus className="h-4 w-4 me-1" />
          {isRTL ? "دور جديد" : "New Role"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Roles sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{isRTL ? "الأدوار" : "Roles"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1 px-3 pb-3">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    selectedRoleId === role.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {role.is_system && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>{lang === "ar" ? role.name_ar : role.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {rolePermissions.filter((rp) => rp.role_id === role.id).length}
                  </Badge>
                </button>
              ))}
            </div>

            {/* Templates section */}
            {templates.length > 0 && (
              <>
                <Separator />
                <div className="px-3 py-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {isRTL ? "القوالب" : "Templates"}
                  </p>
                  {templates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => applyTemplate(tmpl.permissions)}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{lang === "ar" ? tmpl.name_ar : tmpl.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Permissions editor */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {selectedRole && (lang === "ar" ? selectedRole.name_ar : selectedRole.name)}
                  {selectedRole?.is_system && (
                    <Badge variant="outline" className="text-[10px]">{isRTL ? "نظامي" : "System"}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? `${editedPermissions.size} من ${permissions.length} صلاحية مفعّلة`
                    : `${editedPermissions.size} of ${permissions.length} permissions enabled`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {!selectedRole?.is_system && selectedRole && (
                  <Button variant="destructive" size="sm" onClick={() => deleteRole(selectedRole.id)}>
                    <Trash2 className="h-4 w-4 me-1" />
                    {isRTL ? "حذف" : "Delete"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowCreateTemplate(true)} disabled={editedPermissions.size === 0}>
                  <Copy className="h-4 w-4 me-1" />
                  {isRTL ? "حفظ كقالب" : "Save as Template"}
                </Button>
                {hasChanges && (
                  <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                    <Eye className="h-4 w-4 me-1" />
                    {isRTL ? "معاينة" : "Preview"}
                  </Button>
                )}
                <Button size="sm" onClick={savePermissions} disabled={!hasChanges || saving}>
                  <Save className="h-4 w-4 me-1" />
                  {saving ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ" : "Save")}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Tabs defaultValue={Object.keys(groupedPermissions)[0]} className="w-full">
                <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                  {Object.keys(groupedPermissions).map((cat) => (
                    <TabsTrigger key={cat} value={cat} className="text-xs">
                      {CATEGORY_LABELS[cat]?.[lang] ?? cat}
                      <Badge variant="secondary" className="ms-1 text-[10px] px-1">
                        {groupedPermissions[cat].filter((p) => editedPermissions.has(p.key)).length}/{groupedPermissions[cat].length}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <TabsContent key={category} value={category} className="space-y-3">
                    {/* Select all for category */}
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                      <Checkbox
                        checked={isCategoryFullyChecked(category)}
                        // @ts-ignore
                        indeterminate={isCategoryPartiallyChecked(category)}
                        onCheckedChange={(checked) => toggleCategory(category, !!checked)}
                      />
                      <Label className="font-semibold cursor-pointer">
                        {isRTL ? "تحديد الكل" : "Select All"} — {CATEGORY_LABELS[category]?.[lang] ?? category}
                      </Label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {perms.map((perm) => {
                        const isAdded = !originalPermissions.has(perm.key) && editedPermissions.has(perm.key);
                        const isRemoved = originalPermissions.has(perm.key) && !editedPermissions.has(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              isAdded ? "border-green-500/50 bg-green-500/5" :
                              isRemoved ? "border-red-500/50 bg-red-500/5" :
                              editedPermissions.has(perm.key) ? "border-primary/30 bg-primary/5" :
                              "hover:bg-muted/50"
                            }`}
                          >
                            <Checkbox
                              checked={editedPermissions.has(perm.key)}
                              onCheckedChange={() => togglePermission(perm.key)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{lang === "ar" ? perm.name_ar : perm.name_en}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{perm.key}</p>
                            </div>
                            {isAdded && <Badge className="bg-green-500/10 text-green-600 text-[10px]">+</Badge>}
                            {isRemoved && <Badge className="bg-red-500/10 text-red-600 text-[10px]">-</Badge>}
                          </label>
                        );
                      })}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isRTL ? "معاينة التغييرات" : "Preview Changes"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `التغييرات على دور "${selectedRole?.name_ar}"`
                : `Changes for role "${selectedRole?.name}"`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {addedPermissions.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-green-600 mb-2">
                  {isRTL ? `صلاحيات مضافة (${addedPermissions.length})` : `Added (${addedPermissions.length})`}
                </p>
                <div className="space-y-1">
                  {addedPermissions.map((k) => {
                    const p = permissions.find((pd) => pd.key === k);
                    return (
                      <div key={k} className="flex items-center gap-2 text-sm p-2 rounded bg-green-500/5 border border-green-500/20">
                        <span className="text-green-600">+</span>
                        <span>{lang === "ar" ? p?.name_ar : p?.name_en}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {removedPermissions.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-red-600 mb-2">
                  {isRTL ? `صلاحيات محذوفة (${removedPermissions.length})` : `Removed (${removedPermissions.length})`}
                </p>
                <div className="space-y-1">
                  {removedPermissions.map((k) => {
                    const p = permissions.find((pd) => pd.key === k);
                    return (
                      <div key={k} className="flex items-center gap-2 text-sm p-2 rounded bg-red-500/5 border border-red-500/20">
                        <span className="text-red-600">-</span>
                        <span>{lang === "ar" ? p?.name_ar : p?.name_en}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {addedPermissions.length === 0 && removedPermissions.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                {isRTL ? "لا توجد تغييرات" : "No changes"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              {isRTL ? "إغلاق" : "Close"}
            </Button>
            <Button onClick={() => { savePermissions(); setShowPreview(false); }} disabled={saving}>
              <Save className="h-4 w-4 me-1" />
              {isRTL ? "حفظ التغييرات" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Role Dialog */}
      <Dialog open={showCreateRole} onOpenChange={setShowCreateRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "إنشاء دور جديد" : "Create New Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. sales_rep" />
              </div>
              <div>
                <Label>{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input value={newRoleNameAr} onChange={(e) => setNewRoleNameAr(e.target.value)} placeholder="مثال: مندوب مبيعات" />
              </div>
            </div>
            <div>
              <Label>{isRTL ? "الوصف" : "Description"}</Label>
              <Input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRole(false)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={createRole} disabled={!newRoleName || !newRoleNameAr}>
              <Plus className="h-4 w-4 me-1" />
              {isRTL ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as Template Dialog */}
      <Dialog open={showCreateTemplate} onOpenChange={setShowCreateTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "حفظ كقالب صلاحيات" : "Save as Permission Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? "اسم القالب (إنجليزي)" : "Template Name (English)"}</Label>
                <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              </div>
              <div>
                <Label>{isRTL ? "اسم القالب (عربي)" : "Template Name (Arabic)"}</Label>
                <Input value={templateNameAr} onChange={(e) => setTemplateNameAr(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? `سيتم حفظ ${editedPermissions.size} صلاحية في هذا القالب`
                : `${editedPermissions.size} permissions will be saved in this template`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTemplate(false)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={saveAsTemplate} disabled={!templateName || !templateNameAr}>
              <Save className="h-4 w-4 me-1" />
              {isRTL ? "حفظ القالب" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PermissionsManagement;
