import { cn } from "@/lib/utils";

interface NumaxioLogoProps {
  className?: string;
  variant?: "light" | "dark" | "auto";
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl md:text-4xl",
};

const NumaxioLogo = ({ className = "", variant = "dark", size = "md" }: NumaxioLogoProps) => {
  const isLight = variant === "light";
  const base = isLight ? "text-white" : "text-foreground";

  return (
    <span
      className={cn(
        "font-semibold tracking-[0.05em] leading-none select-none shrink-0",
        sizeMap[size],
        base,
        className
      )}
      aria-label="Numaxio"
    >
      NUMA<span className="text-[#2EC4B6]">XIO</span>
    </span>
  );
};

export default NumaxioLogo;
