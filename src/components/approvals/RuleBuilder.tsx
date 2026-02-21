/**
 * RuleBuilder — Dynamic condition builder for workflow rules.
 * Supports operators: >, <, >=, <=, ==, !=
 * Supports fields: amount, department, branch, currency, document_type
 * Logic: AND | OR
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/useLanguage";

export interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

export interface WorkflowRules {
  conditions: RuleCondition[];
  logic: "AND" | "OR";
}

const FIELDS = [
  { value: "amount", ar: "المبلغ", en: "Amount", type: "number" },
  { value: "department", ar: "القسم", en: "Department", type: "text" },
  { value: "branch", ar: "الفرع", en: "Branch", type: "text" },
  { value: "currency", ar: "العملة", en: "Currency", type: "text" },
  { value: "document_type", ar: "نوع المستند", en: "Document Type", type: "text" },
];

const OPERATORS = [
  { value: ">", label: ">", ar: "أكبر من" },
  { value: "<", label: "<", ar: "أصغر من" },
  { value: ">=", label: "≥", ar: "أكبر أو يساوي" },
  { value: "<=", label: "≤", ar: "أصغر أو يساوي" },
  { value: "==", label: "=", ar: "يساوي" },
  { value: "!=", label: "≠", ar: "لا يساوي" },
];

interface RuleBuilderProps {
  rules: WorkflowRules;
  onChange: (rules: WorkflowRules) => void;
}

export function RuleBuilder({ rules, onChange }: RuleBuilderProps) {
  const { isRTL } = useLanguage();

  const addCondition = () => {
    onChange({
      ...rules,
      conditions: [...rules.conditions, { field: "amount", operator: ">", value: "" }],
    });
  };

  const removeCondition = (index: number) => {
    onChange({
      ...rules,
      conditions: rules.conditions.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (index: number, patch: Partial<RuleCondition>) => {
    const updated = [...rules.conditions];
    updated[index] = { ...updated[index], ...patch };
    onChange({ ...rules, conditions: updated });
  };

  const toggleLogic = () => {
    onChange({ ...rules, logic: rules.logic === "AND" ? "OR" : "AND" });
  };

  const getFieldType = (field: string) => FIELDS.find(f => f.value === field)?.type || "text";

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {isRTL ? "شروط التطبيق" : "Matching Rules"}
        </span>
        <div className="flex items-center gap-2">
          {rules.conditions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={toggleLogic}
            >
              {rules.logic === "AND"
                ? (isRTL ? "الكل (AND)" : "ALL (AND)")
                : (isRTL ? "أي واحد (OR)" : "ANY (OR)")}
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={addCondition}>
            <Plus className="w-3 h-3 me-1" />
            {isRTL ? "شرط" : "Rule"}
          </Button>
        </div>
      </div>

      {rules.conditions.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          {isRTL ? "لا توجد شروط — ينطبق دائماً" : "No rules — always applies"}
        </p>
      )}

      {rules.conditions.map((cond, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && (
            <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5">
              {rules.logic}
            </Badge>
          )}
          {/* Field */}
          <Select value={cond.field} onValueChange={(v) => updateCondition(i, { field: v })}>
            <SelectTrigger className="h-8 text-xs w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELDS.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  {isRTL ? f.ar : f.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator */}
          <Select value={cond.operator} onValueChange={(v) => updateCondition(i, { operator: v })}>
            <SelectTrigger className="h-8 text-xs w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value} className="text-xs">
                  {op.label} {isRTL ? op.ar : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value */}
          <Input
            type={getFieldType(cond.field) === "number" ? "number" : "text"}
            value={cond.value}
            onChange={(e) => updateCondition(i, { value: e.target.value })}
            className="h-8 text-xs flex-1"
            placeholder={isRTL ? "القيمة" : "Value"}
          />

          {/* Remove */}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => removeCondition(i)}>
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      ))}

      {rules.conditions.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {isRTL
            ? `سيتم تطبيق السلسلة عند تحقق ${rules.logic === "AND" ? "جميع" : "أي من"} الشروط أعلاه`
            : `Workflow applies when ${rules.logic === "AND" ? "ALL" : "ANY"} conditions above are met`}
        </p>
      )}
    </div>
  );
}

export function rulesToJson(rules: WorkflowRules): Record<string, any> | null {
  if (rules.conditions.length === 0) return null;
  return {
    conditions: rules.conditions.map(c => ({
      field: c.field,
      operator: c.operator,
      value: c.value,
    })),
    logic: rules.logic,
  };
}

export function jsonToRules(json: any): WorkflowRules {
  if (!json || !json.conditions) {
    return { conditions: [], logic: "AND" };
  }
  return {
    conditions: (json.conditions || []).map((c: any) => ({
      field: c.field || "amount",
      operator: c.operator || ">",
      value: String(c.value ?? ""),
    })),
    logic: json.logic === "OR" ? "OR" : "AND",
  };
}
