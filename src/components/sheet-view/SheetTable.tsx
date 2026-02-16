import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2, Trash2, CheckCircle2, Archive, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSheetKeyboard } from "./useSheetKeyboard";

export interface SheetColumn {
  key: string;
  label: string;
  editable: boolean;
  type: "text" | "number" | "select" | "readonly";
  options?: { value: string; label: string }[];
  width?: string;
  align?: "right" | "left" | "center";
  format?: (value: any) => string;
  validate?: (value: any) => string | null;
}

export interface BulkAction {
  key: string;
  label: string;
  icon: ReactNode;
  variant?: "default" | "destructive" | "outline";
  requireConfirm?: boolean;
}

interface SheetTableProps {
  columns: SheetColumn[];
  data: any[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onCellEdit: (id: string, key: string, value: any) => Promise<boolean>;
  bulkActions: BulkAction[];
  onBulkAction: (action: string, ids: string[]) => Promise<void>;
  idKey?: string;
  canEdit: boolean;
}

const SheetTable = ({
  columns, data, loading, selectedIds, onToggleSelect, onToggleSelectAll,
  onCellEdit, bulkActions, onBulkAction, idKey = "id", canEdit
}: SheetTableProps) => {
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState<any>("");
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (rowIdx: number, colIdx: number) => {
    if (!canEdit) return;
    const row = data[rowIdx];
    const col = columns[colIdx];
    if (!col?.editable || col.type === "readonly") return;
    const id = row[idKey];
    setEditingCell({ id, key: col.key });
    setEditValue(row[col.key] ?? "");
    setValidationError(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
    setValidationError(null);
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const col = columns.find(c => c.key === editingCell.key);
    if (col?.validate) {
      const err = col.validate(editValue);
      if (err) { setValidationError(err); return; }
    }
    setSaving(true);
    const ok = await onCellEdit(editingCell.id, editingCell.key, editValue);
    setSaving(false);
    if (ok) cancelEdit();
  };

  const handleToggleSelectByIdx = (rowIdx: number) => {
    const row = data[rowIdx];
    if (row) onToggleSelect(row[idKey]);
  };

  const { focusRow, focusCol } = useSheetKeyboard({
    rowCount: data.length,
    colCount: columns.length,
    onEdit: startEdit,
    onCancelEdit: cancelEdit,
    onSaveEdit: saveEdit,
    onToggleSelect: handleToggleSelectByIdx,
    isEditing: !!editingCell,
  });

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleBulkAction = async (actionKey: string) => {
    const action = bulkActions.find(a => a.key === actionKey);
    if (!action) return;
    if (action.requireConfirm && !window.confirm(`هل أنت متأكد من تنفيذ "${action.label}" على ${selectedIds.size} عنصر؟`)) return;
    setBulkActionLoading(true);
    await onBulkAction(actionKey, Array.from(selectedIds));
    setBulkActionLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 p-3"
          >
            <span className="text-xs font-medium text-accent">{selectedIds.size} محدد</span>
            <div className="flex-1" />
            {bulkActions.map(action => (
              <Button
                key={action.key}
                size="sm"
                variant={action.variant || "outline"}
                onClick={() => handleBulkAction(action.key)}
                disabled={bulkActionLoading}
                className="gap-1.5 text-xs h-8"
              >
                {bulkActionLoading ? <Loader2 size={12} className="animate-spin" /> : action.icon}
                {action.label}
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 p-3 text-center">
                  <Checkbox
                    checked={data.length > 0 && selectedIds.size === data.length}
                    onCheckedChange={onToggleSelectAll}
                  />
                </th>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={cn(
                      "p-3 text-xs font-semibold text-muted-foreground whitespace-nowrap",
                      col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right"
                    )}
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="text-center text-muted-foreground py-16 text-sm">لا توجد بيانات</td></tr>
              ) : data.map((row, rowIdx) => {
                const id = row[idKey];
                const isSelected = selectedIds.has(id);
                const isFocused = focusRow === rowIdx;
                return (
                  <tr
                    key={id}
                    className={cn(
                      "border-b border-border transition-colors",
                      isSelected && "bg-accent/5",
                      isFocused && !isSelected && "bg-muted/30",
                      "hover:bg-muted/20"
                    )}
                  >
                    <td className="w-10 p-3 text-center">
                      <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(id)} />
                    </td>
                    {columns.map((col, colIdx) => {
                      const isEditingThis = editingCell?.id === id && editingCell?.key === col.key;
                      const isCellFocused = isFocused && focusCol === colIdx;
                      const rawVal = row[col.key];
                      const displayVal = col.format ? col.format(rawVal) : rawVal;

                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "p-0 relative",
                            col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right",
                            isCellFocused && !isEditingThis && "ring-2 ring-inset ring-accent/40 rounded-sm"
                          )}
                          onDoubleClick={() => startEdit(rowIdx, colIdx)}
                        >
                          {isEditingThis ? (
                            <div className="flex items-center gap-1 p-1">
                              {col.type === "select" ? (
                                <Select value={String(editValue)} onValueChange={v => setEditValue(v)}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {col.options?.map(o => (
                                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  ref={inputRef}
                                  type={col.type === "number" ? "number" : "text"}
                                  value={editValue}
                                  onChange={e => { setEditValue(e.target.value); setValidationError(null); }}
                                  className={cn("h-8 text-xs", validationError && "border-destructive")}
                                  dir={col.type === "number" ? "ltr" : "rtl"}
                                />
                              )}
                              <button onClick={saveEdit} disabled={saving} className="p-1 text-success hover:text-success/80">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button onClick={cancelEdit} className="p-1 text-destructive hover:text-destructive/80">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className={cn(
                              "px-3 py-3 text-xs cursor-default",
                              col.editable && canEdit && "cursor-pointer hover:bg-accent/5",
                              col.type === "number" && "font-english",
                              !col.editable && "text-muted-foreground"
                            )}>
                              {col.type === "select" && col.options ? (
                                <span className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                  getStatusStyle(String(rawVal))
                                )}>
                                  {col.options.find(o => o.value === String(rawVal))?.label || displayVal}
                                </span>
                              ) : (
                                displayVal ?? "—"
                              )}
                            </div>
                          )}
                          {isEditingThis && validationError && (
                            <div className="absolute top-full right-0 z-10 mt-0.5 rounded bg-destructive px-2 py-1 text-[10px] text-destructive-foreground shadow-lg whitespace-nowrap">
                              {validationError}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function getStatusStyle(status: string): string {
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    issued: "bg-info/10 text-info",
    sent: "bg-info/10 text-info",
    paid: "bg-success/10 text-success",
    overdue: "bg-destructive/10 text-destructive",
    cancelled: "bg-destructive/10 text-destructive",
    approved: "bg-success/10 text-success",
    rejected: "bg-destructive/10 text-destructive",
    pending: "bg-warning/10 text-warning",
    active: "bg-success/10 text-success",
    inactive: "bg-muted text-muted-foreground",
    business: "bg-accent/10 text-accent",
    individual: "bg-info/10 text-info",
    converted: "bg-accent/10 text-accent",
    expired: "bg-destructive/10 text-destructive",
  };
  return styles[status] || "bg-muted text-muted-foreground";
}

export default SheetTable;
