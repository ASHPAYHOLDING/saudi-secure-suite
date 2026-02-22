import numaxioIcon from "@/assets/numaxio-logo-new.png";

interface NumaxioLogoProps {
  className?: string;
  variant?: "light" | "dark" | "auto";
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { height: 44 },
  md: { height: 56 },
  lg: { height: 72 },
};

const NumaxioLogo = ({ className = "", size = "md" }: NumaxioLogoProps) => {
  const s = sizeMap[size];

  return (
    <img
      src={numaxioIcon}
      alt="Numaxio"
      className={className}
      style={{ height: s.height, width: "auto", objectFit: "contain" }}
      draggable={false}
    />
  );
};

export default NumaxioLogo;
