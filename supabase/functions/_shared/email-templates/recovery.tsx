/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import { NumaxioLayout, styles } from './_layout.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <NumaxioLayout preview="إعادة تعيين كلمة المرور — Numaxio">
    <Text style={styles.h1}>طلب إعادة تعيين كلمة المرور</Text>
    <Text style={styles.text}>
      استلمنا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في <strong>Numaxio</strong>.
      اضغط على الزر أدناه لإنشاء كلمة مرور جديدة:
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>إعادة تعيين كلمة المرور</Button>
    </Section>
    <Text style={styles.muted}>
      هذا الرابط صالح لفترة محدودة لأسباب أمنية. إذا لم يعمل الزر، انسخ الرابط التالي:
    </Text>
    <Text style={styles.fallbackBox}>{confirmationUrl}</Text>
    <Hr style={styles.divider} />
    <Text style={styles.muted}>
      🔒 إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة وستبقى كلمة المرور الحالية كما هي.
      ننصحك بمراجعة سجلات الدخول من إعدادات الأمان.
    </Text>
  </NumaxioLayout>
)

export default RecoveryEmail
