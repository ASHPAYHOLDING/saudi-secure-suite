import { Moon, Sun, Sparkles } from "lucide-react";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeSwitcher({ className, showLabel = false }: ThemeSwitcherProps) {
  const { mode, seasonalTheme, toggleMode, setSeasonalTheme } = useTheme();

  const isRamadan = seasonalTheme === "ramadan";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? "sm" : "icon"}
          className={cn(
            "relative gap-2",
            isRamadan && "text-[hsl(var(--ramadan-gold))] hover:text-[hsl(var(--ramadan-gold))]",
            className
          )}
          aria-label="تغيير الثيم"
        >
          {isRamadan ? (
            <Sparkles className="h-4 w-4" />
          ) : mode === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          {showLabel && (
            <span className="text-sm">
              {isRamadan ? "رمضان" : mode === "dark" ? "مظلم" : "مضيء"}
            </span>
          )}
          {isRamadan && (
            <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-[hsl(var(--ramadan-gold))] animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {/* Mode */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">الوضع</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => { setSeasonalTheme("default"); if (mode !== "light") toggleMode(); }}
          className={cn("gap-2 cursor-pointer", mode === "light" && seasonalTheme === "default" && "bg-accent/10 text-accent")}
        >
          <Sun className="h-4 w-4" />
          <span>مضيء</span>
          {mode === "light" && seasonalTheme === "default" && (
            <span className="ms-auto text-xs text-accent">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => { setSeasonalTheme("default"); if (mode !== "dark") toggleMode(); }}
          className={cn("gap-2 cursor-pointer", mode === "dark" && seasonalTheme === "default" && "bg-accent/10 text-accent")}
        >
          <Moon className="h-4 w-4" />
          <span>مظلم</span>
          {mode === "dark" && seasonalTheme === "default" && (
            <span className="ms-auto text-xs text-accent">✓</span>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Seasonal */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">موسمي</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => setSeasonalTheme("ramadan")}
          className={cn(
            "gap-2 cursor-pointer",
            isRamadan && "bg-[hsl(var(--ramadan-gold)/0.1)]"
          )}
        >
          <Sparkles className={cn("h-4 w-4", isRamadan && "text-[hsl(var(--ramadan-gold))]")} />
          <div className="flex flex-col">
            <span className={cn("text-sm", isRamadan && "text-[hsl(var(--ramadan-gold))]")}>
              🌙 ثيم رمضان
            </span>
            <span className="text-xs text-muted-foreground">زمردي + ذهبي + ليلي</span>
          </div>
          {isRamadan && (
            <span className="ms-auto text-xs text-[hsl(var(--ramadan-gold))]">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setSeasonalTheme("default")}
          className={cn("gap-2 cursor-pointer", !isRamadan && "text-muted-foreground")}
        >
          <span className="h-4 w-4 flex items-center justify-center text-xs">⊘</span>
          <span>الوضع الافتراضي</span>
          {!isRamadan && (
            <span className="ms-auto text-xs text-accent">✓</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
