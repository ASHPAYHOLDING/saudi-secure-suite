/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from 'npm:@react-email/components@0.0.22'

// Numaxio brand tokens
export const BRAND = {
  name: 'Numaxio',
  nameAr: 'نُمَاكسيو',
  primary: '#2EC4B6',
  primaryDark: '#1FA89B',
  ink: '#0B1F2A',
  body: '#3A4A55',
  muted: '#7A8894',
  border: '#E6ECEF',
  surface: '#F7FAFB',
  white: '#FFFFFF',
  bg: '#F1F5F7',
  font: "'Tajawal', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
}

interface LayoutProps {
  preview: string
  children: React.ReactNode
}

export const NumaxioLayout = ({ preview, children }: LayoutProps) => (
  <Html lang="ar" dir="rtl">
    <Head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width" />
      <meta name="x-apple-disable-message-reformatting" />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={outer}>
        {/* Brand header */}
        <Section style={header}>
          <Text style={logoText}>
            NUMA<span style={{ color: BRAND.primary }}>XIO</span>
          </Text>
          <Text style={tagline}>منصة الأعمال السعودية المتكاملة</Text>
        </Section>

        {/* Card */}
        <Container style={card}>{children}</Container>

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            هذه رسالة آلية من <strong style={{ color: BRAND.ink }}>Numaxio</strong> — يُرجى عدم الرد عليها.
          </Text>
          <Text style={securityNote}>
            🔒 هذه رسالة <strong>أمنية أساسية</strong> مرتبطة بحسابك ولا يمكن إيقافها للحفاظ على أمان الوصول.
            يمكنك إدارة بقية إشعاراتك من إعدادات الحساب.
          </Text>
          <Text style={footerLinks}>
            <Link href="https://numaxio.com/settings/notifications" style={footerLink}>إدارة التفضيلات</Link>
            {'  ·  '}
            <Link href="https://numaxio.com/contact" style={footerLink}>تواصل معنا</Link>
            {'  ·  '}
            <Link href="https://numaxio.com/privacy" style={footerLink}>الخصوصية</Link>
            {'  ·  '}
            <Link href="https://numaxio.com/terms" style={footerLink}>الشروط</Link>
          </Text>
          <Text style={copy}>© {new Date().getFullYear()} Numaxio. جميع الحقوق محفوظة.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

// Reusable atomic styles
export const styles = {
  h1: {
    fontSize: '24px',
    fontWeight: 700 as const,
    color: BRAND.ink,
    margin: '0 0 16px',
    lineHeight: 1.3,
    fontFamily: BRAND.font,
    textAlign: 'right' as const,
  },
  text: {
    fontSize: '15px',
    color: BRAND.body,
    lineHeight: 1.7,
    margin: '0 0 16px',
    fontFamily: BRAND.font,
    textAlign: 'right' as const,
  },
  muted: {
    fontSize: '13px',
    color: BRAND.muted,
    lineHeight: 1.6,
    margin: '24px 0 0',
    fontFamily: BRAND.font,
    textAlign: 'right' as const,
  },
  buttonWrap: {
    margin: '28px 0',
    textAlign: 'center' as const,
  },
  button: {
    display: 'inline-block',
    backgroundColor: BRAND.primary,
    color: BRAND.white,
    fontSize: '15px',
    fontWeight: 700 as const,
    borderRadius: '10px',
    padding: '14px 36px',
    textDecoration: 'none',
    fontFamily: BRAND.font,
    boxShadow: '0 2px 6px rgba(46, 196, 182, 0.25)',
  },
  link: { color: BRAND.primaryDark, textDecoration: 'underline', fontFamily: BRAND.font },
  codeBox: {
    backgroundColor: BRAND.surface,
    border: `1px solid ${BRAND.border}`,
    borderRadius: '12px',
    padding: '20px',
    margin: '20px 0',
    fontSize: '32px',
    fontWeight: 700 as const,
    color: BRAND.ink,
    letterSpacing: '8px',
    textAlign: 'center' as const,
    fontFamily: "'Courier New', monospace",
  },
  fallbackBox: {
    backgroundColor: BRAND.surface,
    border: `1px solid ${BRAND.border}`,
    borderRadius: '8px',
    padding: '12px 14px',
    margin: '12px 0 0',
    fontSize: '12px',
    color: BRAND.muted,
    wordBreak: 'break-all' as const,
    fontFamily: 'monospace',
    direction: 'ltr' as const,
    textAlign: 'left' as const,
  },
  divider: {
    borderColor: BRAND.border,
    margin: '24px 0',
  },
}

// Layout-only styles
const main = {
  backgroundColor: BRAND.bg,
  fontFamily: BRAND.font,
  margin: 0,
  padding: '24px 0',
}
const outer = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '0 16px',
}
const header = {
  textAlign: 'center' as const,
  padding: '8px 0 20px',
}
const logoText = {
  fontSize: '28px',
  fontWeight: 800 as const,
  letterSpacing: '2px',
  color: BRAND.ink,
  margin: 0,
  fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
}
const tagline = {
  fontSize: '12px',
  color: BRAND.muted,
  margin: '6px 0 0',
  fontFamily: BRAND.font,
}
const card = {
  backgroundColor: BRAND.white,
  borderRadius: '16px',
  padding: '36px 32px',
  border: `1px solid ${BRAND.border}`,
  boxShadow: '0 1px 3px rgba(11, 31, 42, 0.04)',
}
const footer = {
  textAlign: 'center' as const,
  padding: '24px 16px 8px',
}
const footerText = {
  fontSize: '12px',
  color: BRAND.muted,
  margin: '0 0 10px',
  fontFamily: BRAND.font,
}
const footerLinks = {
  fontSize: '12px',
  color: BRAND.muted,
  margin: '0 0 12px',
  fontFamily: BRAND.font,
}
const footerLink = { color: BRAND.primaryDark, textDecoration: 'none' }
const copy = {
  fontSize: '11px',
  color: BRAND.muted,
  margin: 0,
  fontFamily: BRAND.font,
}
