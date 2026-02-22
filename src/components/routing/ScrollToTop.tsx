import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const NAVBAR_HEIGHT = 72;

const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();
  const prevPathSearch = useRef(pathname + search);

  useEffect(() => {
    const currentPathSearch = pathname + search;

    if (hash) {
      // Hash navigation: smooth scroll to element with offset
      const id = hash.replace("#", "");
      // Small delay to let lazy-loaded content render
      const raf = requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_HEIGHT;
          window.scrollTo({ top, left: 0, behavior: "smooth" });
        }
      });
      prevPathSearch.current = currentPathSearch;
      return () => cancelAnimationFrame(raf);
    }

    // Only scroll to top if path or search changed (not hash-only)
    if (currentPathSearch !== prevPathSearch.current) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }

    prevPathSearch.current = currentPathSearch;
  }, [pathname, search, hash]);

  return null;
};

export default ScrollToTop;
