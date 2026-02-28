/**
 * Widget Catalog Drawer — lets users add/remove widgets from their dashboard.
 * Redesigned with cleaner layout and better visual hierarchy.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { LayoutGrid, Lock, Sparkles } from "lucide-react";
import { WIDGET_REGISTRY, type LayoutItem } from "./widget-registry";
import { cn } from "@/lib/utils";

interface Props {
  layout: LayoutItem[];
  onToggleWidget: (widgetId: string, enabled: boolean) => void;
  hasPermission: (key: string | null) => boolean;
}

const WidgetCatalog = ({ layout, onToggleWidget, hasPermission }: Props) => {
  const activeIds = new Set(layout.map((l) => l.i));
  const activeCount = WIDGET_REGISTRY.filter(w => activeIds.has(w.id) && hasPermission(w.permissionKey)).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-lg h-9">
          <LayoutGrid className="w-3.5 h-3.5" />
          Widgets
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ms-0.5">{activeCount}</Badge>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 sm:w-96 p-0" dir="rtl">
        <div className="p-6 pb-4 border-b border-border/50">
          <SheetHeader className="p-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4.5 h-4.5 text-accent" />
              كتالوج العناصر
            </SheetTitle>
          </SheetHeader>
          <p className="text-xs text-muted-foreground mt-1.5">فعّل أو أوقف العناصر التي تريد عرضها في لوحة التحكم</p>
        </div>
        <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-140px)]">
          {WIDGET_REGISTRY.map((w) => {
            const permitted = hasPermission(w.permissionKey);
            const active = activeIds.has(w.id);
            return (
              <div
                key={w.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all",
                  !permitted && "opacity-40 cursor-not-allowed",
                  active
                    ? "border-accent/30 bg-accent/[0.04] shadow-sm"
                    : "border-border/40 hover:border-border/70 hover:bg-muted/30"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  active ? "bg-accent/10" : "bg-muted/60"
                )}>
                  <w.icon size={18} className={cn(active ? "text-accent" : "text-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{w.labelAr}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{w.labelEn}</p>
                </div>
                {!permitted ? (
                  <Badge variant="outline" className="text-[10px] gap-1 border-muted-foreground/20 text-muted-foreground">
                    <Lock size={10} />
                    محظور
                  </Badge>
                ) : (
                  <Switch
                    checked={active}
                    onCheckedChange={(checked) => onToggleWidget(w.id, checked)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WidgetCatalog;
