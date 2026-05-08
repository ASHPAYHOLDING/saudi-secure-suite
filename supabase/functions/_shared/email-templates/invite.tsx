/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import { NumaxioLayout, styles } from './_layout.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <NumaxioLayout preview="دعوة للانضمام إلى فريق على Numaxio">
    <Text style={styles.h1}>تمت دعوتك للانضمام إلى Numaxio 🎉</Text>
    <Text style={styles.text}>
      تلقيت دعوة للانضمام إلى منشأة على منصة <strong>Numaxio</strong> — منصة الأعمال والمحاسبة المتكاملة.
    </Text>
    <Text style={styles.text}>
      اضغط على الزر أدناه لقبول الدعوة وإعداد حسابك خلال دقائق:
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>قبول الدعوة وإنشاء الحساب</Button>
    </Section>
    <Text style={styles.muted}>إذا لم يعمل الزر، انسخ الرابط التالي:</Text>
    <Text style={styles.fallbackBox}>{confirmationUrl}</Text>
    <Hr style={styles.divider} />
    <Text style={styles.muted}>
      إذا كنت لا تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة بأمان.
    </Text>
  </NumaxioLayout>
)

export default InviteEmail
