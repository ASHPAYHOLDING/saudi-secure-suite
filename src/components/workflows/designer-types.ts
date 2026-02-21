// Workflow designer types
export type WorkflowNodeType = "approval" | "condition" | "auto-action" | "notification";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  x: number;
  y: number;
  config: {
    role_required?: string;
    permission_required?: string;
    conditions?: string;
    action_type?: string;
    action_config?: Record<string, unknown>;
    notification_template?: string;
    recipients?: string;
  };
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  condition?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export const NODE_META: Record<WorkflowNodeType, { label: string; labelEn: string; color: string; icon: string }> = {
  approval: { label: "اعتماد", labelEn: "Approval", color: "hsl(var(--accent))", icon: "CheckCircle2" },
  condition: { label: "شرط", labelEn: "Condition", color: "hsl(210, 70%, 50%)", icon: "GitBranch" },
  "auto-action": { label: "إجراء تلقائي", labelEn: "Auto Action", color: "hsl(280, 60%, 50%)", icon: "Zap" },
  notification: { label: "إشعار", labelEn: "Notification", color: "hsl(35, 90%, 50%)", icon: "Bell" },
};
