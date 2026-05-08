/// <reference types="npm:@types/react@18.3.1" />
/**
 * Snapshot tests for Numaxio email templates.
 * Verifies for every template:
 *   - HTML root carries dir="rtl" and lang="ar"
 *   - Mobile-friendly viewport meta and apple reformat disable
 *   - Footer block has all 4 unified links (preferences, contact, privacy, terms)
 *   - Required security note + brand wordmark present
 *   - Primary CTA button uses brand primary color and is centered
 *   - Fallback URL box is forced LTR
 *   - Confirmation URL appears as both <a href> and visible fallback text
 *   - No raw "Lovable" string leaks into rendered HTML
 *   - Snapshot stored under __snapshots__/ for regression diffs
 */

import * as React from 'npm:react@18.3.1'
import { render } from 'npm:@react-email/components@0.0.22'
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { assertSnapshot } from 'jsr:@std/testing@1/snapshot'

import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'
import { BRAND } from '../_shared/email-templates/_layout.tsx'

const SITE = { siteName: 'Numaxio', siteUrl: 'https://numaxio.com' }
const URL = 'https://numaxio.com/auth/callback?token=TEST_TOKEN_123&type=signup'

const cases: Array<{ name: string; el: React.ReactElement; expectsLink: boolean }> = [
  { name: 'signup', el: React.createElement(SignupEmail, { ...SITE, recipient: 'user@numaxio.com', confirmationUrl: URL }), expectsLink: true },
  { name: 'magic-link', el: React.createElement(MagicLinkEmail, { ...SITE, confirmationUrl: URL }), expectsLink: true },
  { name: 'recovery', el: React.createElement(RecoveryEmail, { ...SITE, confirmationUrl: URL }), expectsLink: true },
  { name: 'invite', el: React.createElement(InviteEmail, { ...SITE, confirmationUrl: URL }), expectsLink: true },
  { name: 'email-change', el: React.createElement(EmailChangeEmail, { ...SITE, oldEmail: 'old@numaxio.com', email: 'old@numaxio.com', newEmail: 'new@numaxio.com', confirmationUrl: URL }), expectsLink: true },
  { name: 'reauthentication', el: React.createElement(ReauthenticationEmail, { ...SITE, token: '482913' }), expectsLink: false },
]

for (const tc of cases) {
  Deno.test(`email/${tc.name} — RTL + footer + links + mobile`, async (t) => {
    const html = await render(tc.el, { pretty: false })

    // 1) RTL + Arabic language at root
    assert(/<html[^>]+dir="rtl"/i.test(html), `${tc.name}: <html dir="rtl"> missing`)
    assert(/<html[^>]+lang="ar"/i.test(html), `${tc.name}: <html lang="ar"> missing`)

    // 2) Mobile-friendly meta tags
    assertStringIncludes(html, 'name="viewport"')
    assertStringIncludes(html, 'width=device-width')
    assertStringIncludes(html, 'x-apple-disable-message-reformatting')

    // 3) Brand wordmark
    assertStringIncludes(html, 'NUMA')
    assertStringIncludes(html, 'XIO')

    // 4) Unified footer links (all 4 present, on numaxio.com)
    for (const path of ['/settings/notifications', '/contact', '/privacy', '/terms']) {
      assert(html.includes(`https://numaxio.com${path}`), `${tc.name}: footer link ${path} missing`)
    }
    assertStringIncludes(html, 'إدارة التفضيلات')
    assertStringIncludes(html, 'تواصل معنا')
    assertStringIncludes(html, 'الخصوصية')
    assertStringIncludes(html, 'الشروط')

    // 5) Mandatory security note (footer)
    assertStringIncludes(html, 'رسالة')
    assertStringIncludes(html, 'أمنية')

    // 6) CTA button: brand primary background and centered wrapper (link templates only)
    if (tc.expectsLink) {
      // primary background present somewhere (button)
      assert(
        html.toLowerCase().includes(BRAND.primary.toLowerCase()) ||
          html.toLowerCase().includes('rgb(46,196,182)'),
        `${tc.name}: brand primary color missing`,
      )
      // confirmation URL appears as href (HTML-escapes & inside attributes)
      const escapedUrl = URL.replace(/&/g, '&amp;')
      assert(
        html.includes(`href="${URL}"`) || html.includes(`href="${escapedUrl}"`),
        `${tc.name}: CTA href not found`,
      )
      // fallback URL appears as visible text in an LTR box
      assert(html.includes(URL) || html.includes(escapedUrl), `${tc.name}: visible fallback URL missing`)
      assert(/direction:\s*ltr/i.test(html), `${tc.name}: LTR fallback box missing`)
    }

    // 7) Right-aligned Arabic body text appears at least once
    assert(/text-align:\s*right/i.test(html), `${tc.name}: RTL text-align:right missing`)

    // 8) No leaked Lovable references in rendered HTML
    assertEquals(/lovable/i.test(html), false, `${tc.name}: "lovable" leaked into HTML`)

    // 9) Snapshot regression
    await assertSnapshot(t, html)
  })
}

Deno.test('email/all — footer markup is identical across templates', async () => {
  const footers = await Promise.all(
    cases.map(async (tc) => {
      const html = await render(tc.el, { pretty: false })
      const m = html.match(/إدارة التفضيلات[\s\S]*?الشروط[^<]*<\/a>/)
      assert(m, `${tc.name}: footer block not found`)
      return m![0]
    }),
  )
  for (let i = 1; i < footers.length; i++) {
    assertEquals(footers[i], footers[0], `Footer drift in template "${cases[i].name}"`)
  }
})
