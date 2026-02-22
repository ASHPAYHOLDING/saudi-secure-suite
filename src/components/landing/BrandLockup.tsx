import { cn } from "@/lib/utils";

interface BrandLockupProps {
  variant?: "light" | "dark";
  showSubtitle?: boolean;
  className?: string;
}

const BrandLockup = ({ variant = "dark", className }: BrandLockupProps) => {
  const isLight = variant === "light";
  const base = isLight ? "text-white" : "text-foreground";

  return (
    <span
      className={cn(
        "text-xl md:text-2xl font-semibold tracking-[0.05em] leading-none select-none shrink-0",
        base,
        className
      )}
      aria-label="Numaxio"
    >
      NUMA<span className="text-[#2EC4B6]">XIO</span>
    </span>
  );
};

export default BrandLockup;
