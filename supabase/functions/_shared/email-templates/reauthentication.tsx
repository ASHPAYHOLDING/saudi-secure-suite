/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text, Hr } from 'npm:@react-email/components@0.0.22'
import { NumaxioLayout, styles } from './_layout.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <NumaxioLayout preview="رمز التحقق الخاص بك — Numaxio">
    <Text style={styles.h1}>رمز التحقق</Text>
    <Text style={styles.text}>
      استخدم الرمز التالي لتأكيد هويتك في <strong>Numaxio</strong>:
    </Text>
    <Text style={styles.codeBox}>{token}</Text>
    <Text style={styles.muted}>
      هذا الرمز صالح لفترة قصيرة جداً. لا تشاركه مع أي شخص — فريق Numaxio لن يطلبه منك أبداً.
    </Text>
    <Hr style={styles.divider} />
    <Text style={styles.muted}>
      🔒 إذا لم تطلب هذا الرمز، تجاهل الرسالة وراجع إعدادات الأمان لحسابك فوراً.
    </Text>
  </NumaxioLayout>
)

export default ReauthenticationEmail
