import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FormTooltipProps {
  text: string;
  children?: React.ReactNode;
}

const FormTooltip = ({ text, children }: FormTooltipProps) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        {children || (
          <button type="button" className="inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors focus:outline-none">
            <HelpCircle size={14} />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

/** Label with integrated tooltip */
export const FormLabel = ({
  label,
  tooltip,
  required,
  className = "",
}: {
  label: string;
  tooltip?: string;
  required?: boolean;
  className?: string;
}) => (
  <label className={`flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 ${className}`}>
    <span>{label}{required && <span className="text-destructive mr-0.5"> *</span>}</span>
    {tooltip && <FormTooltip text={tooltip} />}
  </label>
);

export default FormTooltip;
