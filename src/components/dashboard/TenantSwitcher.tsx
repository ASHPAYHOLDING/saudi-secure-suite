import { Building2, Check, ChevronDown } from "lucide-react";
import { useAuth, type TenantInfo } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  owner: { ar: "مالك", en: "Owner" },
  admin: { ar: "مدير", en: "Admin" },
  accountant: { ar: "محاسب", en: "Accountant" },
  hr: { ar: "موارد بشرية", en: "HR" },
  manager: { ar: "مدير قسم", en: "Manager" },
  member: { ar: "عضو", en: "Member" },
};

const TenantSwitcher = () => {
  const { tenantId, userTenants, switchTenant } = useAuth();
  const { isRTL } = useLanguage();

  // Don't show if user has only one tenant
  if (userTenants.length <= 1) return null;

  const currentTenant = userTenants.find((t) => t.id === tenantId);

  const handleSwitch = async (tenant: TenantInfo) => {
    if (tenant.id === tenantId) return;
    await switchTenant(tenant.id);
    toast.success(isRTL ? `تم التبديل إلى ${tenant.name}` : `Switched to ${tenant.nameEn || tenant.name}`);
    // Reload to refresh all data
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9 px-3 max-w-[200px] border-border"
        >
          <Building2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-xs font-medium">
            {isRTL ? currentTenant?.name : (currentTenant?.nameEn || currentTenant?.name) || "—"}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isRTL ? "end" : "start"} className="w-[260px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {isRTL ? "تبديل المنشأة" : "Switch Organization"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {userTenants.map((tenant) => {
          const isCurrent = tenant.id === tenantId;
          const roleLabel = ROLE_LABELS[tenant.role] || { ar: tenant.role, en: tenant.role };
          return (
            <DropdownMenuItem
              key={tenant.id}
              onClick={() => handleSwitch(tenant)}
              className="flex items-center gap-3 py-2.5 cursor-pointer"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} alt="" className="h-6 w-6 rounded object-cover" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {isRTL ? tenant.name : (tenant.nameEn || tenant.name)}
                </p>
                <Badge variant="secondary" className="text-[9px] px-1.5 mt-0.5">
                  {isRTL ? roleLabel.ar : roleLabel.en}
                </Badge>
              </div>
              {isCurrent && <Check className="h-4 w-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TenantSwitcher;
