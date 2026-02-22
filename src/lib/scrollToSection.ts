const NAVBAR_HEIGHT = 64; // h-16
const OFFSET = NAVBAR_HEIGHT + 12;

/**
 * Smooth-scroll to a section by id with navbar offset.
 * If id is "home" or empty, scrolls to top.
 * Optionally accepts a delay (ms) to wait before scrolling (e.g. after closing a drawer).
 */
export function scrollToSection(id: string, delay = 0) {
  const doScroll = () => {
    if (!id || id === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - OFFSET;
      window.scrollTo({ top, left: 0, behavior: "smooth" });
    }
  };

  if (delay > 0) {
    setTimeout(doScroll, delay);
  } else {
    doScroll();
  }
}
