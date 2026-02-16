import { Building, ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBranch } from "@/contexts/BranchContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Badge } from "@/components/ui/badge";

const BranchSelector = () => {
  const { branches, activeBranchId, activeBranch, setActiveBranchId, isAdmin } = useBranch();
  const { currentLang } = useLanguage();

  // Don't show if only one branch
  if (branches.length <= 1 && !isAdmin) return null;

  const label = activeBranch
    ? (currentLang === "en" && activeBranch.name_en ? activeBranch.name_en : activeBranch.name)
    : (currentLang === "ar" ? "جميع الفروع" : "All Branches");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9 px-3 max-w-[200px]">
          <MapPin size={14} className="shrink-0 text-primary" />
          <span className="truncate text-xs font-medium">{label}</span>
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {isAdmin && (
          <>
            <DropdownMenuItem
              onClick={() => setActiveBranchId(null)}
              className={!activeBranchId ? "bg-accent" : ""}
            >
              <Building size={14} className="shrink-0 ml-2" />
              <span>{currentLang === "ar" ? "جميع الفروع (مجمّع)" : "All Branches (Consolidated)"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {branches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => setActiveBranchId(branch.id)}
            className={activeBranchId === branch.id ? "bg-accent" : ""}
          >
            <MapPin size={14} className="shrink-0 ml-2" />
            <span className="flex-1 truncate">
              {currentLang === "en" && branch.name_en ? branch.name_en : branch.name}
            </span>
            {branch.is_main && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {currentLang === "ar" ? "رئيسي" : "HQ"}
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default BranchSelector;
