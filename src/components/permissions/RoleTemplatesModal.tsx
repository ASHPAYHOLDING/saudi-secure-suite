/**
 * RoleTemplatesModal — Enterprise role templates with permission preview.
 * Shows predefined templates, gates enterprise-only ones, and clones into a new role.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, TrendingUp, Search, Wallet, Shield,
  ChevronDown, Crown, Lock, Sparkles, CheckCircle2, Loader2,
} from "lucide-react";
import EnterpriseUpgradeWall from "@/components/enterprise/EnterpriseUpgradeWall";

interface RoleTemplate {
  id: string;
  key: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  icon: string;
  is_enterprise_only: boolean;
  permissions: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleCreated: (roleId: string) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Calculator, TrendingUp, Search, Wallet, Shield,
};

const RoleTemplatesModal = ({ open, onOpenChange, onRoleCreated }: Props) => {
  const { tenantId, user } = useAuth();
  const { isRTL } = useLanguage();
  const { entitlementsMap } = useEntitlementsContext();
  const lang = isRTL ? "ar" : "en";

  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleNameAr, setRoleNameAr] = useState("");
  const [creating, setCreating] = useState(false);

  const hasEnterprise = !!entitlementsMap?.enterprise_mode;

  useEffect(() => {
    if (!open) return;
    const fetchTemplates = async () => {
      setLoading(true);
      const [tRes, tpRes] = await Promise.all([
        supabase.from("role_templates" as any).select("*").order("created_at"),
        supabase.from("role_template_permissions" as any).select("template_id, permission_key"),
      ]);

      const rawTemplates = (tRes.data ?? []) as any[];
      const rawPerms = (tpRes.data ?? []) as any[];

      const permMap: Record<string, string[]> = {};
      rawPerms.forEach((p: any) => {
        if (!permMap[p.template_id]) permMap[p.template_id] = [];
        permMap[p.template_id].push(p.permission_key);
      });

      setTemplates(
        rawTemplates.map((t: any) => ({
          ...t,
          permissions: permMap[t.id] ?? [],
        }))
      );
      setLoading(false);
    };
    fetchTemplates();
  }, [open]);

  const selectTemplate = (t: RoleTemplate) => {
    if (t.is_enterprise_only && !hasEnterprise) return;
    setSelectedTemplate(t);
    setRoleName(t.name_en);
    setRoleNameAr(t.name_ar);
  };

  const createFromTemplate = async () => {
    if (!tenantId || !user || !selectedTemplate || !roleName || !roleNameAr) return;
    setCreating(true);
    try {
      // Create role
      const { data: role, error: roleErr } = await supabase
        .from("custom_roles")
        .insert({
          tenant_id: tenantId,
          name: roleName,
          name_ar: roleNameAr,
          description: `Created from template: ${selectedTemplate.key}`,
          is_system: false,
          created_by: user.id,
        })
        .select()
        .single();
      if (roleErr) throw roleErr;

      // Clone permissions
      if (selectedTemplate.permissions.length > 0) {
        const permRows = selectedTemplate.permissions.map((pk) => ({
          tenant_id: tenantId,
          role_id: role.id,
          permission_key: pk,
        }));
        const { error: permErr } = await supabase.from("role_permissions").insert(permRows);
        if (permErr) throw permErr;
      }

      toast.success(
        isRTL
          ? `تم إنشاء الدور "${roleNameAr}" بنجاح مع ${selectedTemplate.permissions.length} صلاحية`
          : `Role "${roleName}" created with ${selectedTemplate.permissions.length} permissions`
      );
      onRoleCreated(role.id);
      onOpenChange(false);
      setSelectedTemplate(null);
    } catch (err: any) {
      toast.error(err.message || "Error creating role");
    }
    setCreating(false);
  };

  const groupPermissions = (perms: string[]) => {
    const groups: Record<string, string[]> = {};
    perms.forEach((p) => {
      const [cat] = p.split(".");
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            {isRTL ? "إنشاء دور من قالب" : "Create Role from Template"}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? "اختر قالباً جاهزاً لإنشاء دور جديد بصلاحيات مُعدّة مسبقاً"
              : "Choose a preset template to create a new role with pre-configured permissions"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedTemplate ? (
              /* Step 2: Configure & Create */
              <motion.div
                key="configure"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5 pb-4"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTemplate(null)}
                  className="text-muted-foreground"
                >
                  {isRTL ? "← رجوع للقوالب" : "← Back to templates"}
                </Button>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-accent/5 border border-accent/10">
                  {(() => {
                    const Icon = ICON_MAP[selectedTemplate.icon] ?? Shield;
                    return <Icon className="h-6 w-6 text-accent" />;
                  })()}
                  <div>
                    <h3 className="font-semibold">
                      {lang === "ar" ? selectedTemplate.name_ar : selectedTemplate.name_en}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedTemplate.permissions.length} {isRTL ? "صلاحية" : "permissions"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? "اسم الدور (إنجليزي)" : "Role Name (English)"}</Label>
                    <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "اسم الدور (عربي)" : "Role Name (Arabic)"}</Label>
                    <Input value={roleNameAr} onChange={(e) => setRoleNameAr(e.target.value)} />
                  </div>
                </div>

                {/* Permission preview */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {isRTL ? "الصلاحيات المضمّنة" : "Included Permissions"}
                  </p>
                  <div className="space-y-1">
                    {Object.entries(groupPermissions(selectedTemplate.permissions)).map(([cat, perms]) => (
                      <div key={cat} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        <span className="text-sm font-medium capitalize">{cat}</span>
                        <Badge variant="secondary" className="text-[10px] ms-auto">
                          {perms.length}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isRTL
                      ? "يمكنك تعديل الصلاحيات بعد إنشاء الدور"
                      : "You can edit permissions after creating the role"}
                  </p>
                </div>

                <Button
                  onClick={createFromTemplate}
                  disabled={creating || !roleName || !roleNameAr}
                  className="w-full gap-2"
                  size="lg"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {creating
                    ? (isRTL ? "جاري الإنشاء..." : "Creating...")
                    : (isRTL ? "إنشاء الدور" : "Create Role")}
                </Button>
              </motion.div>
            ) : (
              /* Step 1: Template Selection */
              <motion.div
                key="selection"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3 pb-4"
              >
                {templates.map((t, i) => {
                  const Icon = ICON_MAP[t.icon] ?? Shield;
                  const isLocked = t.is_enterprise_only && !hasEnterprise;
                  const isExpanded = expandedId === t.id;

                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div
                        className={`rounded-xl border transition-all ${
                          isLocked
                            ? "opacity-60 border-border"
                            : "hover:border-accent/30 hover:shadow-sm cursor-pointer border-border"
                        }`}
                      >
                        <div className="p-4 flex items-center gap-4">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${
                            isLocked ? "bg-muted" : "bg-accent/10"
                          }`}>
                            {isLocked ? (
                              <Lock className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Icon className="h-5 w-5 text-accent" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm">
                                {lang === "ar" ? t.name_ar : t.name_en}
                              </h3>
                              {t.is_enterprise_only && (
                                <Badge className="enterprise-indicator border-accent/25 text-accent text-[9px] px-1.5 py-0">
                                  <Crown className="h-2.5 w-2.5 me-0.5" />
                                  Enterprise
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {lang === "ar" ? t.description_ar : t.description_en}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : t.id)}>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 px-2">
                                  <span className="text-xs text-muted-foreground me-1">
                                    {t.permissions.length}
                                  </span>
                                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </Button>
                              </CollapsibleTrigger>
                            </Collapsible>

                            <Button
                              size="sm"
                              variant={isLocked ? "outline" : "default"}
                              disabled={isLocked}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTemplate(t);
                              }}
                              className="h-8"
                            >
                              {isLocked
                                ? (isRTL ? "مقفل" : "Locked")
                                : (isRTL ? "استخدام" : "Use")}
                            </Button>
                          </div>
                        </div>

                        {/* Expandable permissions preview */}
                        <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : t.id)}>
                          <CollapsibleContent>
                            <div className="px-4 pb-4 pt-0">
                              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/50">
                                {t.permissions.map((p) => (
                                  <Badge
                                    key={p}
                                    variant="secondary"
                                    className="text-[10px] font-mono"
                                  >
                                    {p}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Enterprise upgrade prompt if any template is locked */}
                {templates.some((t) => t.is_enterprise_only) && !hasEnterprise && (
                  <div className="mt-4">
                    <EnterpriseUpgradeWall compact featureContext={isRTL ? "قوالب الأدوار المؤسسية" : "Enterprise Role Templates"} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RoleTemplatesModal;
