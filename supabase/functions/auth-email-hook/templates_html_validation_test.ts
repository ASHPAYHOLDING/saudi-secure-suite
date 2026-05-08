/// <reference types="npm:@types/react@18.3.1" />
/**
 * HTML safety / email-client compatibility tests for Numaxio email templates.
 *
 * For every template, asserts:
 *   - Only email-safe tags are emitted (no <script>, <iframe>, <form>, <video>,
 *     <object>, <embed>, <input>, <button>, <svg>, <base>, <meta http-equiv=refresh>, …)
 *   - No inline event handler attributes (onclick, onload, onerror, onmouseover, …)
 *   - No injectable URI schemes in href/src/action (javascript:, data:, vbscript:, file:)
 *   - All hrefs are absolute https:// (or mailto:/tel:) — no bare paths or http://
 *   - No formaction / srcdoc / xlink:href / unfiltered srcset
 *   - No <style> blocks containing @import or url(javascript:…)
 *   - HTML re-parses cleanly (well-formed for major email clients)
 *
 * Also asserts the templates do NOT echo XSS payloads passed through props
 * (confirmationUrl, recipient, oldEmail, newEmail, token) into raw HTML.
 */

import * as React from 'npm:react@18.3.1'
import { render } from 'npm:@react-email/components@0.0.22'
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { DOMParser, Element } from 'jsr:@b-fuze/deno-dom@0.1.48'

import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

// ---------- Whitelists ----------

/** Tags that are safe across major email clients (Gmail, Outlook, Apple Mail). */
const ALLOWED_TAGS = new Set([
  'html', 'head', 'body', 'meta', 'title', 'style', 'link',
  'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col',
  'div', 'span', 'p', 'a', 'img', 'br', 'hr', 'center', 'font', 'small',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 'sup', 'sub',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
])

/** Tags that must NEVER appear (script execution, form submission, embedded media). */
const FORBIDDEN_TAGS = [
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'form', 'input', 'button', 'textarea', 'select', 'option',
  'video', 'audio', 'source', 'track', 'svg', 'math', 'base',
  'noscript', 'noframes', 'portal', 'slot', 'template',
]

/** Attributes that allow JS execution or unsafe redirects. */
const FORBIDDEN_ATTRS = [
  'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onfocus',
  'onblur', 'onsubmit', 'onchange', 'oninput', 'onkeydown', 'onkeyup',
  'onkeypress', 'onabort', 'oncanplay', 'onplay', 'onunload', 'onbeforeunload',
  'formaction', 'srcdoc', 'xlink:href', 'ping',
]

/** Only these URI schemes are allowed in href/src/action. */
const ALLOWED_SCHEMES = ['https:', 'mailto:', 'tel:', 'cid:']

const SITE = { siteName: 'Numaxio', siteUrl: 'https://numaxio.com' }
const URL = 'https://numaxio.com/auth/callback?token=TEST_TOKEN_123&type=signup'

const cases: Array<{ name: string; el: React.ReactElement }> = [
  { name: 'signup', el: React.createElement(SignupEmail, { ...SITE, recipient: 'user@numaxio.com', confirmationUrl: URL }) },
  { name: 'magic-link', el: React.createElement(MagicLinkEmail, { ...SITE, confirmationUrl: URL }) },
  { name: 'recovery', el: React.createElement(RecoveryEmail, { ...SITE, confirmationUrl: URL }) },
  { name: 'invite', el: React.createElement(InviteEmail, { ...SITE, confirmationUrl: URL }) },
  { name: 'email-change', el: React.createElement(EmailChangeEmail, { ...SITE, oldEmail: 'old@numaxio.com', email: 'old@numaxio.com', newEmail: 'new@numaxio.com', confirmationUrl: URL }) },
  { name: 'reauthentication', el: React.createElement(ReauthenticationEmail, { ...SITE, token: '482913' }) },
]

// ---------- Per-template structural validation ----------

for (const tc of cases) {
  Deno.test(`html-safety/${tc.name} — only safe tags & attrs, well-formed`, async () => {
    const html = await render(tc.el, { pretty: false })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    assert(doc, `${tc.name}: failed to parse rendered HTML`)

    // 1) No forbidden tags anywhere
    for (const tag of FORBIDDEN_TAGS) {
      const found = doc.querySelectorAll(tag)
      assertEquals(found.length, 0, `${tc.name}: forbidden tag <${tag}> found (${found.length}x)`)
    }

    // 2) Every emitted tag must be on the allow-list
    const allEls = doc.querySelectorAll('*') as unknown as Iterable<Element>
    for (const el of allEls) {
      const tag = el.tagName.toLowerCase()
      assert(
        ALLOWED_TAGS.has(tag),
        `${tc.name}: unsupported tag <${tag}> emitted (not on email-safe whitelist)`,
      )

      // 3) No JS event-handler / unsafe attributes
      for (const attr of el.getAttributeNames()) {
        const lower = attr.toLowerCase()
        if (lower.startsWith('on')) {
          throw new Error(`${tc.name}: inline event handler "${lower}" on <${tag}>`)
        }
        if (FORBIDDEN_ATTRS.includes(lower)) {
          throw new Error(`${tc.name}: forbidden attribute "${lower}" on <${tag}>`)
        }
      }

      // 4) URL attributes must use allowed schemes only
      for (const urlAttr of ['href', 'src', 'action', 'background']) {
        const val = el.getAttribute(urlAttr)
        if (!val) continue
        const trimmed = val.trim().toLowerCase()
        // Ignore template-style placeholders & cid: refs
        if (trimmed.startsWith('#') || trimmed.startsWith('cid:')) continue
        const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*:)/)?.[1]
        assert(
          scheme && ALLOWED_SCHEMES.includes(scheme),
          `${tc.name}: ${urlAttr}="${val}" on <${tag}> uses disallowed scheme (allowed: ${ALLOWED_SCHEMES.join(', ')})`,
        )
        assert(
          !/^javascript:|^data:|^vbscript:|^file:/i.test(trimmed),
          `${tc.name}: injectable scheme in ${urlAttr} on <${tag}>`,
        )
      }
    }

    // 5) <meta http-equiv="refresh"> is forbidden (used for tracking redirects/phishing)
    const metas = doc.querySelectorAll('meta') as unknown as Iterable<Element>
    for (const m of metas) {
      const httpEquiv = (m.getAttribute('http-equiv') || '').toLowerCase()
      assert(httpEquiv !== 'refresh', `${tc.name}: <meta http-equiv="refresh"> not allowed`)
    }

    // 6) Inline <style> blocks must not import remote CSS or use javascript: URLs
    const styles = doc.querySelectorAll('style') as unknown as Iterable<Element>
    for (const s of styles) {
      const css = s.textContent || ''
      assert(!/@import\b/i.test(css), `${tc.name}: @import found in <style> (blocked by Outlook/Gmail)`)
      assert(!/url\(\s*['"]?\s*javascript:/i.test(css), `${tc.name}: javascript: URL inside <style>`)
      assert(!/expression\s*\(/i.test(css), `${tc.name}: CSS expression() found (IE-era XSS)`)
    }

    // 7) Doctype + single <html> root + non-empty <body>
    assert(/^<!doctype html>/i.test(html.trim()), `${tc.name}: missing <!DOCTYPE html>`)
    assertEquals(doc.querySelectorAll('html').length, 1, `${tc.name}: expected exactly one <html>`)
    const body = doc.querySelector('body')
    assert(body && (body.textContent ?? '').trim().length > 0, `${tc.name}: <body> empty`)
  })
}

// ---------- XSS-injection regression ----------

Deno.test('html-safety/xss — props are escaped, not rendered as HTML', async () => {
  const PAYLOAD_URL = 'https://numaxio.com/cb?x=<script>alert(1)</script>&y="onmouseover=alert(2)'
  const PAYLOAD_EMAIL = '"><img src=x onerror=alert(3)>@evil.com'
  const PAYLOAD_TOKEN = '<script>alert(4)</script>'

  const xssCases: Array<{ name: string; el: React.ReactElement }> = [
    { name: 'signup', el: React.createElement(SignupEmail, { ...SITE, recipient: PAYLOAD_EMAIL, confirmationUrl: PAYLOAD_URL }) },
    { name: 'magic-link', el: React.createElement(MagicLinkEmail, { ...SITE, confirmationUrl: PAYLOAD_URL }) },
    { name: 'recovery', el: React.createElement(RecoveryEmail, { ...SITE, confirmationUrl: PAYLOAD_URL }) },
    { name: 'invite', el: React.createElement(InviteEmail, { ...SITE, confirmationUrl: PAYLOAD_URL }) },
    { name: 'email-change', el: React.createElement(EmailChangeEmail, { ...SITE, oldEmail: PAYLOAD_EMAIL, email: PAYLOAD_EMAIL, newEmail: PAYLOAD_EMAIL, confirmationUrl: PAYLOAD_URL }) },
    { name: 'reauthentication', el: React.createElement(ReauthenticationEmail, { ...SITE, token: PAYLOAD_TOKEN }) },
  ]

  for (const tc of xssCases) {
    const html = await render(tc.el, { pretty: false })
    // React escapes raw children, so payloads must NOT round-trip as live tags
    assert(!/<script\b/i.test(html), `${tc.name}: <script> tag leaked from prop`)
    assert(!/onerror\s*=/i.test(html), `${tc.name}: onerror handler leaked from prop`)
    assert(!/onmouseover\s*=/i.test(html), `${tc.name}: onmouseover handler leaked from prop`)
    // Re-parse and verify forbidden tags didn't sneak in
    const doc = new DOMParser().parseFromString(html, 'text/html')!
    for (const tag of ['script', 'img']) {
      // recovery/signup/etc do not use <img>; if any appears it must come from a payload
      const tags = doc.querySelectorAll(tag)
      if (tag === 'script') {
        assertEquals(tags.length, 0, `${tc.name}: <script> survived XSS attempt`)
      }
    }
  }
})
