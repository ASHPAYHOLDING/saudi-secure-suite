import DOMPurify from "dompurify";

/**
 * Allowed HTML elements — safe subset for displaying rich content.
 * Everything else (script, iframe, object, embed, style, form, etc.) is stripped.
 */
const ALLOWED_TAGS = [
  "p", "br", "b", "strong", "i", "em",
  "ul", "ol", "li",
  "a",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "pre", "code",
  "img", "hr", "sup", "sub", "u", "s", "del",
];

/**
 * Allowed attributes — no on* event handlers pass through.
 */
const ALLOWED_ATTR = [
  "href", "target", "rel",
  "src", "alt", "width", "height",
  "class", "style", "dir", "lang",
  "colspan", "rowspan", "scope", "align", "valign",
  "id",
];

/**
 * Sanitize untrusted HTML for safe rendering via dangerouslySetInnerHTML.
 *
 * - Strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `on*` handlers
 * - Adds `rel="noopener noreferrer"` to all `target="_blank"` links
 * - Logs a dev warning when dangerous content is removed
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  // Dev-only: warn when dangerous content is detected
  if (import.meta.env.DEV) {
    if (/<script[\s>]/i.test(html)) {
      console.warn("[sanitizeHtml] ⚠️ Stripped <script> tag from HTML content");
    }
    if (/\bon\w+\s*=/i.test(html)) {
      console.warn("[sanitizeHtml] ⚠️ Stripped on* event handler from HTML content");
    }
    if (/<iframe[\s>]/i.test(html)) {
      console.warn("[sanitizeHtml] ⚠️ Stripped <iframe> tag from HTML content");
    }
  }

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  });

  // Post-process: enforce rel="noopener noreferrer" on target="_blank" links
  if (typeof document !== "undefined") {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = clean;
    wrapper.querySelectorAll('a[target="_blank"]').forEach((a) => {
      a.setAttribute("rel", "noopener noreferrer");
    });
    return wrapper.innerHTML;
  }

  return clean;
}
