/**
 * SecurityHeaders — Centralised security-header reference & runtime checks.
 *
 * Because Lovable's hosting does not expose server-config files,
 * most headers are applied via `<meta>` in index.html.
 *
 * This module:
 *  1. Documents the full desired header set (for when you move to custom hosting).
 *  2. Provides a dev-only console audit that warns if CSP meta is missing.
 */

/** Full header map — apply on your reverse-proxy / CDN when self-hosting. */
export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "media-src 'self' blob: https:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),

  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * Dev-only: verify that a CSP meta tag exists in the document.
 * Call once at app bootstrap (main.tsx) in DEV mode.
 */
export function auditSecurityHeaders(): void {
  if (!import.meta.env.DEV) return;

  const cspMeta = document.querySelector(
    'meta[http-equiv="Content-Security-Policy"], meta[http-equiv="Content-Security-Policy-Report-Only"]'
  );
  if (!cspMeta) {
    console.warn(
      "[SecurityHeaders] ⚠️ No CSP <meta> tag found in index.html. " +
        "Add one or configure server-side headers."
    );
  } else {
    console.info(
      "[SecurityHeaders] ✅ CSP meta tag detected:",
      cspMeta.getAttribute("http-equiv")
    );
  }

  const referrerMeta = document.querySelector('meta[name="referrer"]');
  if (!referrerMeta) {
    console.warn('[SecurityHeaders] ⚠️ No <meta name="referrer"> tag found.');
  }
}
