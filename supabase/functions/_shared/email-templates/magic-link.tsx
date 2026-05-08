/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import { NumaxioLayout, styles } from './_layout.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <NumaxioLayout preview="رابط الدخول السريع إلى Numaxio">
    <Text style={styles.h1}>رابط الدخول السريع</Text>
    <Text style={styles.text}>
      اضغط على الزر أدناه لتسجيل الدخول إلى حسابك في <strong>Numaxio</strong> دون الحاجة إلى كلمة مرور:
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>تسجيل الدخول الآن</Button>
    </Section>
    <Text style={styles.muted}>
      الرابط صالح لمدة قصيرة ولاستخدام واحد فقط. إذا لم يعمل الزر:
    </Text>
    <Text style={styles.fallbackBox}>{confirmationUrl}</Text>
    <Hr style={styles.divider} />
    <Text style={styles.muted}>
      🔒 إذا لم تطلب تسجيل الدخول، تجاهل هذه الرسالة — لا يوجد إجراء مطلوب منك.
    </Text>
  </NumaxioLayout>
)

export default MagicLinkEmail
