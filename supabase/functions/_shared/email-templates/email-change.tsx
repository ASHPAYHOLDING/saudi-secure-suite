/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import { NumaxioLayout, styles, BRAND } from './_layout.tsx'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <NumaxioLayout preview="تأكيد تغيير البريد الإلكتروني — Numaxio">
    <Text style={styles.h1}>تأكيد تغيير البريد الإلكتروني</Text>
    <Text style={styles.text}>
      استلمنا طلباً لتغيير البريد المرتبط بحسابك في <strong>Numaxio</strong>:
    </Text>
    <Section style={{
      backgroundColor: BRAND.surface,
      borderRadius: '10px',
      padding: '14px 16px',
      margin: '12px 0 20px',
      border: `1px solid ${BRAND.border}`,
    }}>
      <Text style={{ ...styles.text, margin: '0 0 6px', fontSize: '13px' }}>
        <span style={{ color: BRAND.muted }}>من: </span>
        <strong style={{ direction: 'ltr', display: 'inline-block' }}>{oldEmail}</strong>
      </Text>
      <Text style={{ ...styles.text, margin: 0, fontSize: '13px' }}>
        <span style={{ color: BRAND.muted }}>إلى: </span>
        <strong style={{ direction: 'ltr', display: 'inline-block', color: BRAND.primaryDark }}>{newEmail}</strong>
      </Text>
    </Section>
    <Text style={styles.text}>اضغط على الزر أدناه لتأكيد التغيير:</Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>تأكيد البريد الجديد</Button>
    </Section>
    <Text style={styles.muted}>إذا لم يعمل الزر:</Text>
    <Text style={styles.fallbackBox}>{confirmationUrl}</Text>
    <Hr style={styles.divider} />
    <Text style={styles.muted}>
      🔒 إذا لم تطلب هذا التغيير، تجاهل هذه الرسالة وراجع إعدادات الأمان فوراً.
    </Text>
  </NumaxioLayout>
)

export default EmailChangeEmail
