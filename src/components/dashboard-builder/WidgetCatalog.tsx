/**
 * Widget Catalog Drawer — lets users add/remove widgets from their dashboard.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Lock } from "lucide-react";
import { WIDGET_REGISTRY, type LayoutItem, type WidgetDef } from "./widget-registry";
import { cn } from "@/lib/utils";

interface Props {
  layout: LayoutItem[];
  onToggleWidget: (widgetId: string, enabled: boolean) => void;
  /** Check if the user has permission for this widget */
  hasPermission: (key: string | null) => boolean;
}

const WidgetCatalog = ({ layout, onToggleWidget, hasPermission }: Props) => {
  const activeIds = new Set(layout.map((l) => l.i));

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus size={14} />
          إضافة Widget
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 sm:w-96" dir="rtl">
        <SheetHeader>
          <SheetTitle>كتالوج Widgets</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {WIDGET_REGISTRY.map((w) => {
            const permitted = hasPermission(w.permissionKey);
            const active = activeIds.has(w.id);
            return (
              <div
                key={w.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                  !permitted && "opacity-50",
                  active ? "border-accent/30 bg-accent/5" : "border-border/50"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                  active ? "bg-accent/10" : "bg-muted"
                )}>
                  <w.icon size={18} className={active ? "text-accent" : "text-muted-foreground"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{w.labelAr}</p>
                  <p className="text-[10px] text-muted-foreground">{w.labelEn}</p>
                </div>
                {!permitted ? (
                  <Badge variant="outline" className="text-[10px] gap-1 border-muted-foreground/30">
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
