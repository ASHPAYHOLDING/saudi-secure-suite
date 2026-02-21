import type { WorkflowNode, WorkflowNodeType } from "./designer-types";
import { NODE_META } from "./designer-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, GitBranch, Zap, Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  node: WorkflowNode | null;
  onUpdate: (node: WorkflowNode) => void;
  onClose: () => void;
}

export const NodePropertiesPanel = ({ node, onUpdate, onClose }: Props) => {
  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
        <div>
          <p className="font-medium mb-1">اختر عنصراً من الـ Canvas</p>
          <p className="text-xs opacity-60">أو أضف عنصراً جديداً من شريط الأدوات</p>
        </div>
      </div>
    );
  }

  const meta = NODE_META[node.type];
  const updateConfig = (key: string, value: string) => {
    onUpdate({ ...node, config: { ...node.config, [key]: value } });
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: meta.color }} />
          <h3 className="font-semibold text-sm">{meta.label}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X size={14} />
        </Button>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">اسم العنصر</Label>
          <Input
            value={node.label}
            onChange={(e) => onUpdate({ ...node, label: e.target.value })}
            placeholder={meta.label}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">النوع</Label>
          <Select
            value={node.type}
            onValueChange={(v) => onUpdate({ ...node, type: v as WorkflowNodeType })}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(NODE_META).map(([key, m]) => (
                <SelectItem key={key} value={key}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Type-specific config */}
        {(node.type === "approval" || node.type === "condition") && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">الدور المطلوب</Label>
              <Input
                value={node.config.role_required || ""}
                onChange={(e) => updateConfig("role_required", e.target.value)}
                placeholder="admin, manager..."
                className="h-8 text-sm"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الصلاحية المطلوبة</Label>
              <Input
                value={node.config.permission_required || ""}
                onChange={(e) => updateConfig("permission_required", e.target.value)}
                placeholder="expenses.approve"
                className="h-8 text-sm"
                dir="ltr"
              />
            </div>
          </>
        )}

        {node.type === "condition" && (
          <div className="space-y-1.5">
            <Label className="text-xs">الشروط (تعبير)</Label>
            <textarea
              value={node.config.conditions || ""}
              onChange={(e) => updateConfig("conditions", e.target.value)}
              placeholder="amount > 10000"
              className="w-full min-h-[60px] rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
              dir="ltr"
            />
          </div>
        )}

        {node.type === "auto-action" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">نوع الإجراء</Label>
              <Select
                value={node.config.action_type || ""}
                onValueChange={(v) => updateConfig("action_type", v)}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="update_status">تحديث الحالة</SelectItem>
                  <SelectItem value="send_email">إرسال بريد</SelectItem>
                  <SelectItem value="create_task">إنشاء مهمة</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {node.type === "notification" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">المستلمون</Label>
              <Input
                value={node.config.recipients || ""}
                onChange={(e) => updateConfig("recipients", e.target.value)}
                placeholder="requester, manager"
                className="h-8 text-sm"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">نص الإشعار</Label>
              <Input
                value={node.config.notification_template || ""}
                onChange={(e) => updateConfig("notification_template", e.target.value)}
                placeholder="تمت الموافقة على الطلب..."
                className="h-8 text-sm"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
