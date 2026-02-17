import { useTranslation } from "react-i18next";
import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Apply full RTL/LTR adjustments to the DOM.
 * - Sets dir & lang on <html>
 * - Adds/removes the "rtl" class on <body> for CSS hooks
 * - Adjusts all containers, buttons, sidebar, and cards to follow direction
 * - Handles mixed-content (Arabic + English) without breaking layout
 */
const applyDirectionToDOM = (lang: "ar" | "en") => {
  const isRTL = lang === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  // 1. Set dir & lang on <html> and <body>
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lang);
  document.body.setAttribute("dir", dir);

  // Toggle RTL class on body for additional CSS hooks
  document.body.classList.toggle("rtl", isRTL);
  document.body.classList.toggle("ltr", !isRTL);

  // 2. Set dir on all main containers
  document.querySelectorAll<HTMLElement>(
    "main, aside, nav, header, footer, section, [role='dialog'], [role='menu'], [role='tablist']"
  ).forEach((el) => {
    // Don't override elements that explicitly set dir="ltr" (e.g. email inputs, OTP)
    if (el.getAttribute("data-dir-locked") !== "true") {
      el.dir = dir;
    }
  });

  // 3. Adjust text alignment on key elements
  document.body.style.textAlign = isRTL ? "right" : "left";

  // 4. Handle mixed-content: keep English snippets LTR inside RTL
  document.querySelectorAll<HTMLElement>(".font-english, [dir='ltr'], code, pre").forEach((el) => {
    el.dir = "ltr";
    el.style.textAlign = "left";
  });

  // 5. Flip directional icons (.rtl-flip)
  document.querySelectorAll<HTMLElement>(".rtl-flip").forEach((el) => {
    el.style.transform = isRTL ? "scaleX(-1)" : "";
  });
};

/**
 * Hook to manage language switching with RTL/LTR and persistence.
 * Automatically applies full DOM direction adjustments on language change
 * and on initial mount.
 */
export const useLanguage = () => {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const currentLang = i18n.language?.startsWith("ar") ? "ar" : "en";
  const isRTL = currentLang === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  // Apply direction on mount and when language changes
  useEffect(() => {
    applyDirectionToDOM(currentLang as "ar" | "en");
  }, [currentLang]);

  // Re-apply after route navigation (content may have re-rendered)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      // Re-apply direction to any newly added containers
      const htmlDir = document.documentElement.dir;
      if (htmlDir) {
        document.querySelectorAll<HTMLElement>(
          "main:not([dir]), aside:not([dir]), section:not([dir])"
        ).forEach((el) => {
          if (el.getAttribute("data-dir-locked") !== "true") {
            el.dir = htmlDir;
          }
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const switchLanguage = useCallback(
    async (lang: "ar" | "en") => {
      await i18n.changeLanguage(lang);

      // Apply full DOM direction adjustments immediately
      applyDirectionToDOM(lang);

      // Persist to profile if logged in
      if (user) {
        await supabase
          .from("profiles")
          .update({ language: lang })
          .eq("id", user.id);
      }
    },
    [i18n, user]
  );

  const toggleLanguage = useCallback(() => {
    switchLanguage(currentLang === "ar" ? "en" : "ar");
  }, [currentLang, switchLanguage]);

  return { currentLang, isRTL, dir, switchLanguage, toggleLanguage, t };
};
