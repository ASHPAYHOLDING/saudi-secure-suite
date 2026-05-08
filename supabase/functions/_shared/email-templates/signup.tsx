/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import { NumaxioLayout, styles } from './_layout.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <NumaxioLayout preview="فعّل حسابك في Numaxio">
    <Text style={styles.h1}>أهلاً بك في Numaxio 👋</Text>
    <Text style={styles.text}>
      شكراً لانضمامك إلى منصة <strong>Numaxio</strong> — منصة الأعمال والمحاسبة المتكاملة المتوافقة مع متطلبات هيئة الزكاة والضريبة (ZATCA).
    </Text>
    <Text style={styles.text}>
      لتأكيد بريدك <strong>{recipient}</strong> وتفعيل حسابك، اضغط على الزر أدناه:
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>تأكيد البريد وتفعيل الحساب</Button>
    </Section>
    <Text style={styles.muted}>
      إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:
    </Text>
    <Text style={styles.fallbackBox}>{confirmationUrl}</Text>
    <Hr style={styles.divider} />
    <Text style={styles.muted}>
      إذا لم تقم بإنشاء حساب لدى Numaxio، يمكنك تجاهل هذه الرسالة بأمان.
    </Text>
  </NumaxioLayout>
)

export default SignupEmail
