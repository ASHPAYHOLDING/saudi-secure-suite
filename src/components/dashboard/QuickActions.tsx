import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
}

const QuickActions = ({ actions, className }: QuickActionsProps) => {
  if (actions.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.variant || "outline"}
          size="sm"
          onClick={action.onClick}
          className="gap-2 h-9"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
};

export default QuickActions;
