import React from "react";
import { MoreVertical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

export interface TableColumn<T> {
  key: string;
  header: string;
  /** Render cell content */
  render: (row: T, index: number) => React.ReactNode;
  /** Hide on mobile card view */
  hideOnMobile?: boolean;
  /** Cell className */
  className?: string;
  /** Header className */
  headerClassName?: string;
}

export interface TableAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  variant?: "default" | "destructive";
}

export interface MobileCardConfig<T> {
  /** Main title line */
  title: (row: T) => React.ReactNode;
  /** Subtitle/description */
  subtitle?: (row: T) => React.ReactNode;
  /** Badge/status */
  badge?: (row: T) => React.ReactNode;
  /** Bottom-right value (e.g. amount) */
  value?: (row: T) => React.ReactNode;
  /** Bottom-left metadata */
  meta?: (row: T) => React.ReactNode;
  /** onClick whole card */
  onClick?: (row: T) => void;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  mobileCard?: MobileCardConfig<T>;
  loading?: boolean;
  emptyState?: React.ReactNode;
  keyExtractor: (row: T) => string;
  className?: string;
}

function ResponsiveTable<T>({
  data,
  columns,
  actions,
  mobileCard,
  loading,
  emptyState,
  keyExtractor,
  className,
}: ResponsiveTableProps<T>) {
  const { isRTL } = useLanguage();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm overflow-hidden", className)}>
      {/* ── Mobile Card View ── */}
      {mobileCard && (
        <div className="md:hidden divide-y divide-border">
          {data.map((row) => (
            <div
              key={keyExtractor(row)}
              className={cn(
                "p-4 transition-colors hover:bg-muted/30",
                mobileCard.onClick && "cursor-pointer active:bg-muted/50"
              )}
              onClick={() => mobileCard.onClick?.(row)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-foreground truncate">
                    {mobileCard.title(row)}
                  </div>
                  {mobileCard.subtitle && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {mobileCard.subtitle(row)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {mobileCard.badge?.(row)}
                  {actions && actions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? "start" : "end"}>
                        {actions.map((action) => (
                          <DropdownMenuItem
                            key={action.label}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(row);
                            }}
                            className={cn(
                              "gap-2 cursor-pointer",
                              action.variant === "destructive" && "text-destructive focus:text-destructive"
                            )}
                          >
                            {action.icon}
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              {(mobileCard.meta || mobileCard.value) && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{mobileCard.meta?.(row)}</span>
                  <span className="font-semibold text-foreground">
                    {mobileCard.value?.(row)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Desktop Table ── */}
      <div className={cn("overflow-x-auto", mobileCard ? "hidden md:block" : "block")}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-start font-semibold text-muted-foreground text-xs whitespace-nowrap",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th className="px-4 py-3 text-start font-semibold text-muted-foreground text-xs w-20">
                  {isRTL ? "إجراءات" : "Actions"}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={keyExtractor(row)}
                className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3", col.className)}
                  >
                    {col.render(row, i)}
                  </td>
                ))}
                {actions && actions.length > 0 && (
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? "start" : "end"}>
                        {actions.map((action) => (
                          <DropdownMenuItem
                            key={action.label}
                            onClick={() => action.onClick(row)}
                            className={cn(
                              "gap-2 cursor-pointer",
                              action.variant === "destructive" && "text-destructive focus:text-destructive"
                            )}
                          >
                            {action.icon}
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="py-12 text-center text-muted-foreground">
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ResponsiveTable;
