import { motion } from "framer-motion";
import { LucideIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SmartEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tips?: string[];
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryIcon?: LucideIcon;
  onSecondary?: () => void;
}

const SmartEmptyState = ({
  icon: Icon,
  title,
  description,
  tips,
  actionLabel,
  onAction,
  secondaryLabel,
  secondaryIcon: SecIcon = Upload,
  onSecondary,
}: SmartEmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-16 px-6 text-center"
  >
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-5 flex-none shrink-0"
    >
      <Icon size={28} className="text-primary" />
    </motion.div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>

    {tips && tips.length > 0 && (
      <div className="rounded-xl border border-border bg-muted/30 p-4 max-w-sm mb-6 text-start">
        <p className="text-xs font-semibold text-foreground mb-2">💡 خطوات البدء:</p>
        <ul className="space-y-1.5">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary mt-0.5">
                {i + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <div className="flex items-center gap-3 flex-wrap justify-center">
      {actionLabel && onAction && (
        <Button onClick={onAction} className="gap-2">
          {actionLabel}
        </Button>
      )}
      {secondaryLabel && onSecondary && (
        <Button variant="outline" onClick={onSecondary} className="gap-2">
          <SecIcon size={14} />
          {secondaryLabel}
        </Button>
      )}
    </div>
  </motion.div>
);

export default SmartEmptyState;
