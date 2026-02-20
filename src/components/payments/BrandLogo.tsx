import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  provider: "tap" | "moyasar" | "hyperpay" | "stripe" | "geidea";
  className?: string;
  /** Override automatic dark/light detection */
  variant?: "light" | "dark";
}

const LOGO_PATHS: Record<string, { light: string; dark: string }> = {
  tap:      { light: "/brands/payment/tap.png",      dark: "/brands/payment/tap.png"           },
  moyasar:  { light: "/brands/payment/moyasar.svg",  dark: "/brands/payment/moyasar-dark.svg"  },
  hyperpay: { light: "/brands/payment/hyperpay.svg", dark: "/brands/payment/hyperpay-dark.svg" },
  stripe:   { light: "/brands/payment/stripe.svg",   dark: "/brands/payment/stripe-dark.svg"   },
  geidea:   { light: "/brands/payment/geidea.svg",   dark: "/brands/payment/geidea-dark.svg"   },
};

const ALT_LABELS: Record<string, string> = {
  tap:      "Tap Payments",
  moyasar:  "Moyasar",
  hyperpay: "HyperPay",
  stripe:   "Stripe",
  geidea:   "Geidea",
};

export const BrandLogo = ({ provider, className, variant }: BrandLogoProps) => {
  const { resolvedTheme } = useTheme();

  const isDark = variant
    ? variant === "dark"
    : resolvedTheme === "dark";

  const paths = LOGO_PATHS[provider];
  if (!paths) return null;

  const src = isDark ? paths.dark : paths.light;

  return (
    <img
      src={src}
      alt={ALT_LABELS[provider] ?? provider}
      // Force LTR so SVG text/content isn't mirrored in RTL layout
      dir="ltr"
      className={cn(
        "h-6 sm:h-7 w-auto object-contain select-none",
        className
      )}
      draggable={false}
    />
  );
};

export default BrandLogo;
