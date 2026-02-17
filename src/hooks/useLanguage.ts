import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Apply full RTL/LTR adjustments to the DOM.
 */
const applyDirectionToDOM = (lang: "ar" | "en") => {
  const isRTL = lang === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lang);
  document.body.setAttribute("dir", dir);
  document.body.classList.toggle("rtl", isRTL);
  document.body.classList.toggle("ltr", !isRTL);
  document.body.style.textAlign = isRTL ? "right" : "left";

  document.querySelectorAll<HTMLElement>(".rtl-flip").forEach((el) => {
    el.style.transform = isRTL ? "scaleX(-1)" : "";
  });
};

/**
 * Hook to manage language switching with RTL/LTR and persistence.
 */
export const useLanguage = () => {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const observerRef = useRef<MutationObserver | null>(null);
  const currentLang = i18n.language?.startsWith("ar") ? "ar" : "en";
  const isRTL = currentLang === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  // Apply direction on mount and when language changes + observe DOM
  useEffect(() => {
    applyDirectionToDOM(currentLang as "ar" | "en");

    // Clean up previous observer
    observerRef.current?.disconnect();

    // Observe DOM for newly added containers
    const observer = new MutationObserver(() => {
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
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [currentLang]);

  const switchLanguage = useCallback(
    async (lang: "ar" | "en") => {
      await i18n.changeLanguage(lang);
      applyDirectionToDOM(lang);

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
