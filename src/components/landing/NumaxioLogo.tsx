import numaxioLogo from "@/assets/numaxio-logo.png";

interface NumaxioLogoProps {
  className?: string;
  variant?: "light" | "dark" | "auto";
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { height: 32 },
  md: { height: 40 },
  lg: { height: 52 },
};

const NumaxioLogo = ({ className = "", size = "md" }: NumaxioLogoProps) => {
  const s = sizeMap[size];

  return (
    <img
      src={numaxioLogo}
      alt="Numaxio"
      className={className}
      style={{ height: s.height, width: "auto", objectFit: "contain" }}
      draggable={false}
    />
  );
};

export default NumaxioLogo;
