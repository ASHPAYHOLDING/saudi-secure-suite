import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  provider: "tap" | "moyasar" | "hyperpay" | "stripe" | "geidea" | "paytabs" | "myfatoorah" | "telr" | "paypal" | "tabby" | "tamara";
  className?: string;
  variant?: "light" | "dark";
}

const LOGO_PATHS: Record<string, { light: string; dark: string }> = {
  tap:         { light: "/brands/payment/tap.png",         dark: "/brands/payment/tap.png"          },
  moyasar:     { light: "/brands/payment/moyasar.jpg",     dark: "/brands/payment/moyasar.jpg"      },
  hyperpay:    { light: "/brands/payment/hyperpay.svg",    dark: "/brands/payment/hyperpay.svg"     },
  stripe:      { light: "/brands/payment/stripe.png",      dark: "/brands/payment/stripe.png"       },
  geidea:      { light: "/brands/payment/geidea.png",      dark: "/brands/payment/geidea.png"       },
  paytabs:     { light: "/brands/payment/paytabs.svg",     dark: "/brands/payment/paytabs.svg"      },
  myfatoorah:  { light: "/brands/payment/myfatoorah.svg",  dark: "/brands/payment/myfatoorah.svg"  },
  telr:        { light: "/brands/payment/telr.svg",        dark: "/brands/payment/telr.svg"         },
  paypal:      { light: "/brands/payment/paypal.svg",      dark: "/brands/payment/paypal.svg"       },
  tabby:       { light: "/brands/payment/tabby.svg",       dark: "/brands/payment/tabby.svg"        },
  tamara:      { light: "/brands/payment/tamara.svg",      dark: "/brands/payment/tamara.svg"       },
};

const ALT_LABELS: Record<string, string> = {
  tap:        "Tap Payments",
  moyasar:    "Moyasar",
  hyperpay:   "HyperPay",
  stripe:     "Stripe",
  geidea:     "Geidea",
  paytabs:    "PayTabs",
  myfatoorah: "MyFatoorah",
  telr:       "Telr",
  paypal:     "PayPal",
  tabby:      "Tabby",
  tamara:     "Tamara",
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

