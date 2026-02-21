import React from "react";
import { cn } from "@/lib/utils";
import QuickActions, { type QuickAction } from "./QuickActions";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: QuickAction[];
  children?: React.ReactNode;
  className?: string;
}

const PageHeader = ({ title, description, actions, children, className }: PageHeaderProps) => {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap", className)}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {actions && <QuickActions actions={actions} />}
        {children}
      </div>
    </div>
  );
};

export default PageHeader;
