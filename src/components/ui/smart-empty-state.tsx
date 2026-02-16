import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SmartEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tips?: string[];
  actionLabel?: string;
  onAction?: () => void;
}

const SmartEmptyState = ({ icon: Icon, title, description, tips, actionLabel, onAction }: SmartEmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-16 px-6 text-center"
  >
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 mb-5">
      <Icon size={28} className="text-accent" />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>
    
    {tips && tips.length > 0 && (
      <div className="rounded-xl border border-border bg-muted/30 p-4 max-w-sm mb-6 text-start">
        <p className="text-xs font-semibold text-foreground mb-2">💡 نصائح للبدء:</p>
        <ul className="space-y-1.5">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent mt-0.5">{i + 1}</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
    
    {actionLabel && onAction && (
      <Button onClick={onAction} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
        {actionLabel}
      </Button>
    )}
  </motion.div>
);

export default SmartEmptyState;
