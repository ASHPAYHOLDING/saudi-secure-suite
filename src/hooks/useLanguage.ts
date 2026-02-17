import { useTranslation } from "react-i18next";
import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Apply RTL/LTR direction to the document.
 */
const applyDirection = (lang: "ar" | "en") => {
  const dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lang);
  document.body.style.direction = dir;
  document.body.style.textAlign = lang === "ar" ? "right" : "left";
};

/**
 * Hook to manage language switching with RTL/LTR and persistence.
 */
export const useLanguage = () => {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const currentLang = i18n.language?.startsWith("ar") ? "ar" : "en";
  const isRTL = currentLang === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  useEffect(() => {
    applyDirection(currentLang as "ar" | "en");
  }, [currentLang]);

  const switchLanguage = useCallback(
    async (lang: "ar" | "en") => {
      await i18n.changeLanguage(lang);
      applyDirection(lang);
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
