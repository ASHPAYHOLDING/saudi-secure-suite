import { useTranslation } from "react-i18next";
import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to manage language switching with RTL/LTR and persistence.
 */
export const useLanguage = () => {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const currentLang = i18n.language?.startsWith("ar") ? "ar" : "en";
  const isRTL = currentLang === "ar";
  const dir = isRTL ? "rtl" : "ltr";

  // Apply dir + lang to <html>
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = currentLang;
  }, [dir, currentLang]);

  const switchLanguage = useCallback(
    async (lang: "ar" | "en") => {
      await i18n.changeLanguage(lang);
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = lang;

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
