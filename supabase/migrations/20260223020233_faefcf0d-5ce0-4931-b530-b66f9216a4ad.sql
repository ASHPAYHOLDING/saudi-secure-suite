
-- =============================================
-- Enhance notification_event_templates for Template Studio
-- =============================================

-- Add new columns
ALTER TABLE public.notification_event_templates
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS body_text TEXT,
  ADD COLUMN IF NOT EXISTS variables_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS design_tokens JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add check constraint for scope
ALTER TABLE public.notification_event_templates
  ADD CONSTRAINT chk_template_scope CHECK (scope IN ('platform','tenant'));

-- Add check for tenant_id requirement
ALTER TABLE public.notification_event_templates
  ADD CONSTRAINT chk_template_tenant CHECK (
    (scope = 'platform' AND tenant_id IS NULL) OR
    (scope = 'tenant' AND tenant_id IS NOT NULL)
  );

-- Drop old unique constraint if exists and create new one
DROP INDEX IF EXISTS notification_event_templates_event_key_channel_lang_is_platfor;

-- Create unique partial index: one active template per scope/tenant/event/channel/lang
CREATE UNIQUE INDEX uq_template_active
  ON public.notification_event_templates (scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), event_key, channel, lang, version)
  WHERE is_active = true;

-- RLS policies for tenant templates
CREATE POLICY "Tenant members can read own templates"
  ON public.notification_event_templates
  FOR SELECT
  USING (
    scope = 'platform'
    OR (scope = 'tenant' AND tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    ))
  );

CREATE POLICY "Tenant owner/admin can manage own templates"
  ON public.notification_event_templates
  FOR INSERT
  WITH CHECK (
    scope = 'tenant' AND tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner','admin')
    )
  );

CREATE POLICY "Tenant owner/admin can update own templates"
  ON public.notification_event_templates
  FOR UPDATE
  USING (
    scope = 'tenant' AND tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner','admin')
    )
  );

-- =============================================
-- Seed default variables_schema for existing templates
-- =============================================
UPDATE public.notification_event_templates
SET variables_schema = '{"invoice_number":{"label_ar":"رقم الفاتورة","label_en":"Invoice Number","example":"INV-2026-001"},"amount":{"label_ar":"المبلغ","label_en":"Amount","example":"5,000.00"},"currency":{"label_ar":"العملة","label_en":"Currency","example":"ر.س"},"due_date":{"label_ar":"تاريخ الاستحقاق","label_en":"Due Date","example":"2026-03-15"},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"أحمد محمد"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"شركة المثال"}}'::jsonb
WHERE event_key LIKE 'invoice_%';

UPDATE public.notification_event_templates
SET variables_schema = '{"otp_code":{"label_ar":"رمز التحقق","label_en":"OTP Code","example":"482917"},"user_name":{"label_ar":"اسم المستخدم","label_en":"User Name","example":"أحمد"}}'::jsonb
WHERE event_key = 'otp_login';

-- Update scope for existing platform templates
UPDATE public.notification_event_templates SET scope = 'platform' WHERE is_platform_default = true;

-- =============================================
-- Seed beautiful HTML email templates (6 types × 2 langs)
-- =============================================

-- 1) invoice_created - AR
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'invoice_created', 'email', 'ar',
  'فاتورة جديدة: {{invoice_number}}',
  'تم إنشاء فاتورة جديدة',
  'تم إنشاء الفاتورة رقم {{invoice_number}} بمبلغ {{amount}} {{currency}}.',
  '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Tajawal,"Segoe UI",Tahoma,sans-serif;direction:rtl}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:1px solid #f3f4f6}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.hdr p{margin:6px 0 0;font-size:13px;color:#6b7280}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.tbl{width:100%;border-collapse:collapse;margin:16px 0}.tbl td{padding:10px 0;font-size:13px;border-bottom:1px solid #f3f4f6}.tbl td:last-child{text-align:left;font-weight:600;color:#111827}.cta{display:inline-block;background:#111827;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin:8px 0}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><h1>فاتورة جديدة</h1><p>{{company_name}}</p></div><div class="bd"><p>مرحباً {{recipient_name}}،</p><p>تم إنشاء فاتورة جديدة في حسابكم بالتفاصيل التالية:</p><table class="tbl"><tr><td>رقم الفاتورة</td><td>{{invoice_number}}</td></tr><tr><td>المبلغ</td><td>{{amount}} {{currency}}</td></tr><tr><td>تاريخ الاستحقاق</td><td>{{due_date}}</td></tr></table><p style="text-align:center"><a class="cta" href="{{cta_url}}">عرض الفاتورة</a></p></div><div class="ft"><p>{{company_name}}</p><p>هذه رسالة آلية — لا تتطلب رداً</p></div></div></div></body></html>',
  'مرحباً {{recipient_name}}، تم إنشاء فاتورة رقم {{invoice_number}} بمبلغ {{amount}} {{currency}}. تاريخ الاستحقاق: {{due_date}}.',
  true, true, 'platform',
  '{"invoice_number":{"label_ar":"رقم الفاتورة","label_en":"Invoice Number","example":"INV-2026-001"},"amount":{"label_ar":"المبلغ","label_en":"Amount","example":"5,000.00"},"currency":{"label_ar":"العملة","label_en":"Currency","example":"ر.س"},"due_date":{"label_ar":"تاريخ الاستحقاق","label_en":"Due Date","example":"2026-03-15"},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"أحمد محمد"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"شركة المثال"},"cta_url":{"label_ar":"رابط الإجراء","label_en":"CTA URL","example":"#"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 1) invoice_created - EN
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'invoice_created', 'email', 'en',
  'New Invoice: {{invoice_number}}',
  'New Invoice Created',
  'Invoice #{{invoice_number}} for {{amount}} {{currency}} has been created.',
  '<!DOCTYPE html><html dir="ltr" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Inter,"Segoe UI",system-ui,sans-serif;direction:ltr}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:1px solid #f3f4f6}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.hdr p{margin:6px 0 0;font-size:13px;color:#6b7280}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.tbl{width:100%;border-collapse:collapse;margin:16px 0}.tbl td{padding:10px 0;font-size:13px;border-bottom:1px solid #f3f4f6}.tbl td:last-child{text-align:right;font-weight:600;color:#111827}.cta{display:inline-block;background:#111827;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin:8px 0}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><h1>New Invoice</h1><p>{{company_name}}</p></div><div class="bd"><p>Hello {{recipient_name}},</p><p>A new invoice has been created with the following details:</p><table class="tbl"><tr><td>Invoice Number</td><td>{{invoice_number}}</td></tr><tr><td>Amount</td><td>{{amount}} {{currency}}</td></tr><tr><td>Due Date</td><td>{{due_date}}</td></tr></table><p style="text-align:center"><a class="cta" href="{{cta_url}}">View Invoice</a></p></div><div class="ft"><p>{{company_name}}</p><p>This is an automated message — no reply required</p></div></div></div></body></html>',
  'Hello {{recipient_name}}, Invoice #{{invoice_number}} for {{amount}} {{currency}} has been created. Due date: {{due_date}}.',
  true, true, 'platform',
  '{"invoice_number":{"label_ar":"رقم الفاتورة","label_en":"Invoice Number","example":"INV-2026-001"},"amount":{"label_ar":"المبلغ","label_en":"Amount","example":"5,000.00"},"currency":{"label_ar":"العملة","label_en":"Currency","example":"SAR"},"due_date":{"label_ar":"تاريخ الاستحقاق","label_en":"Due Date","example":"2026-03-15"},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"Ahmed Mohammed"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"Example Corp"},"cta_url":{"label_ar":"رابط الإجراء","label_en":"CTA URL","example":"#"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 2) invoice_paid - AR
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'invoice_paid', 'email', 'ar',
  'تم سداد الفاتورة {{invoice_number}}',
  'تأكيد السداد',
  'تم سداد الفاتورة رقم {{invoice_number}} بمبلغ {{amount}} {{currency}} بنجاح.',
  '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Tajawal,"Segoe UI",Tahoma,sans-serif;direction:rtl}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:12px}.badge{display:inline-flex;align-items:center;gap:6px;background:#ecfdf5;color:#059669;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.tbl{width:100%;border-collapse:collapse;margin:16px 0}.tbl td{padding:10px 0;font-size:13px;border-bottom:1px solid #f3f4f6}.tbl td:last-child{text-align:left;font-weight:600;color:#111827}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><div><h1>تأكيد السداد</h1><p style="margin:4px 0 0;font-size:13px;color:#6b7280">{{company_name}}</p></div></div><div class="bd"><div class="badge">✓ تم السداد بنجاح</div><p style="margin-top:16px">مرحباً {{recipient_name}}،</p><p>نؤكد لكم استلام سداد الفاتورة التالية:</p><table class="tbl"><tr><td>رقم الفاتورة</td><td>{{invoice_number}}</td></tr><tr><td>المبلغ المسدد</td><td>{{amount}} {{currency}}</td></tr><tr><td>تاريخ السداد</td><td>{{date}}</td></tr></table></div><div class="ft"><p>{{company_name}}</p><p>هذه رسالة آلية — لا تتطلب رداً</p></div></div></div></body></html>',
  'مرحباً {{recipient_name}}، تم سداد الفاتورة رقم {{invoice_number}} بمبلغ {{amount}} {{currency}} بنجاح.',
  true, true, 'platform',
  '{"invoice_number":{"label_ar":"رقم الفاتورة","label_en":"Invoice Number","example":"INV-2026-001"},"amount":{"label_ar":"المبلغ","label_en":"Amount","example":"5,000.00"},"currency":{"label_ar":"العملة","label_en":"Currency","example":"ر.س"},"date":{"label_ar":"التاريخ","label_en":"Date","example":"2026-03-10"},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"أحمد محمد"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"شركة المثال"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 2) invoice_paid - EN
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'invoice_paid', 'email', 'en',
  'Payment Received: {{invoice_number}}',
  'Payment Confirmation',
  'Invoice #{{invoice_number}} for {{amount}} {{currency}} has been paid.',
  '<!DOCTYPE html><html dir="ltr" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Inter,"Segoe UI",system-ui,sans-serif;direction:ltr}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:1px solid #f3f4f6}.badge{display:inline-flex;align-items:center;gap:6px;background:#ecfdf5;color:#059669;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.tbl{width:100%;border-collapse:collapse;margin:16px 0}.tbl td{padding:10px 0;font-size:13px;border-bottom:1px solid #f3f4f6}.tbl td:last-child{text-align:right;font-weight:600;color:#111827}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><div><h1>Payment Confirmation</h1><p style="margin:4px 0 0;font-size:13px;color:#6b7280">{{company_name}}</p></div></div><div class="bd"><div class="badge">✓ Payment Received</div><p style="margin-top:16px">Hello {{recipient_name}},</p><p>We confirm receipt of payment for the following invoice:</p><table class="tbl"><tr><td>Invoice Number</td><td>{{invoice_number}}</td></tr><tr><td>Amount Paid</td><td>{{amount}} {{currency}}</td></tr><tr><td>Payment Date</td><td>{{date}}</td></tr></table></div><div class="ft"><p>{{company_name}}</p><p>This is an automated message — no reply required</p></div></div></div></body></html>',
  'Hello {{recipient_name}}, Invoice #{{invoice_number}} for {{amount}} {{currency}} has been paid.',
  true, true, 'platform',
  '{"invoice_number":{"label_ar":"رقم الفاتورة","label_en":"Invoice Number","example":"INV-2026-001"},"amount":{"label_ar":"المبلغ","label_en":"Amount","example":"5,000.00"},"currency":{"label_ar":"العملة","label_en":"Currency","example":"SAR"},"date":{"label_ar":"التاريخ","label_en":"Date","example":"2026-03-10"},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"Ahmed Mohammed"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"Example Corp"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 3) security_login_alert - AR
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'otp_login', 'email', 'ar',
  'تنبيه أمني: تسجيل دخول جديد',
  'تنبيه أمان',
  'تم تسجيل دخول جديد إلى حسابك. رمز التحقق: {{otp_code}}',
  '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Tajawal,"Segoe UI",Tahoma,sans-serif;direction:rtl}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:2px solid #fbbf24}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.otp{text-align:center;margin:24px 0}.otp span{display:inline-block;background:#f3f4f6;color:#111827;font-size:28px;font-weight:700;letter-spacing:8px;padding:16px 32px;border-radius:12px;font-family:monospace}.warn{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0}.warn p{margin:0;font-size:12px;color:#92400e;line-height:1.7}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><h1>🔐 تنبيه أمان</h1></div><div class="bd"><p>مرحباً {{user_name}}،</p><p>تم طلب رمز تحقق لتسجيل الدخول إلى حسابك. استخدم الرمز التالي:</p><div class="otp"><span>{{otp_code}}</span></div><div class="warn"><p>⚠️ لا تشارك هذا الرمز مع أي شخص. فريقنا لن يطلب منك هذا الرمز أبداً.</p></div><p style="font-size:12px;color:#6b7280">هذا الرمز صالح لمدة 10 دقائق فقط.</p></div><div class="ft"><p>هذه رسالة آلية — لا تتطلب رداً</p></div></div></div></body></html>',
  'مرحباً {{user_name}}، رمز التحقق الخاص بك: {{otp_code}}. لا تشارك هذا الرمز مع أي شخص.',
  true, true, 'platform',
  '{"otp_code":{"label_ar":"رمز التحقق","label_en":"OTP Code","example":"482917"},"user_name":{"label_ar":"اسم المستخدم","label_en":"User Name","example":"أحمد محمد"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 3) security_login_alert - EN
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'otp_login', 'email', 'en',
  'Security Alert: New Login Attempt',
  'Security Alert',
  'A verification code was requested for your account. Code: {{otp_code}}',
  '<!DOCTYPE html><html dir="ltr" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Inter,"Segoe UI",system-ui,sans-serif;direction:ltr}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:2px solid #fbbf24}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.otp{text-align:center;margin:24px 0}.otp span{display:inline-block;background:#f3f4f6;color:#111827;font-size:28px;font-weight:700;letter-spacing:8px;padding:16px 32px;border-radius:12px;font-family:monospace}.warn{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0}.warn p{margin:0;font-size:12px;color:#92400e;line-height:1.7}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><h1>🔐 Security Alert</h1></div><div class="bd"><p>Hello {{user_name}},</p><p>A verification code was requested for your account. Use the code below:</p><div class="otp"><span>{{otp_code}}</span></div><div class="warn"><p>⚠️ Never share this code with anyone. Our team will never ask for this code.</p></div><p style="font-size:12px;color:#6b7280">This code is valid for 10 minutes only.</p></div><div class="ft"><p>This is an automated message — no reply required</p></div></div></div></body></html>',
  'Hello {{user_name}}, your verification code is: {{otp_code}}. Never share this code with anyone.',
  true, true, 'platform',
  '{"otp_code":{"label_ar":"رمز التحقق","label_en":"OTP Code","example":"482917"},"user_name":{"label_ar":"اسم المستخدم","label_en":"User Name","example":"Ahmed Mohammed"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 4) payment_failed - AR
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'invoice_overdue', 'email', 'ar',
  'فاتورة متأخرة: {{invoice_number}}',
  'فاتورة متأخرة السداد',
  'الفاتورة رقم {{invoice_number}} بمبلغ {{amount}} {{currency}} تجاوزت تاريخ الاستحقاق.',
  '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Tajawal,"Segoe UI",Tahoma,sans-serif;direction:rtl}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:2px solid #ef4444}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.alert{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin:16px 0}.alert p{margin:0;font-size:13px;color:#991b1b;font-weight:500}.tbl{width:100%;border-collapse:collapse;margin:16px 0}.tbl td{padding:10px 0;font-size:13px;border-bottom:1px solid #f3f4f6}.tbl td:last-child{text-align:left;font-weight:600;color:#111827}.cta{display:inline-block;background:#111827;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><h1>فاتورة متأخرة السداد</h1><p style="margin:4px 0 0;font-size:13px;color:#6b7280">{{company_name}}</p></div><div class="bd"><div class="alert"><p>⚠️ هذه الفاتورة تجاوزت تاريخ الاستحقاق</p></div><p>مرحباً {{recipient_name}}،</p><p>نود إبلاغكم بأن الفاتورة التالية لم يتم سدادها في الموعد المحدد:</p><table class="tbl"><tr><td>رقم الفاتورة</td><td>{{invoice_number}}</td></tr><tr><td>المبلغ</td><td>{{amount}} {{currency}}</td></tr><tr><td>تاريخ الاستحقاق</td><td>{{due_date}}</td></tr></table><p style="text-align:center"><a class="cta" href="{{cta_url}}">سداد الفاتورة</a></p></div><div class="ft"><p>{{company_name}}</p><p>هذه رسالة آلية — لا تتطلب رداً</p></div></div></div></body></html>',
  'مرحباً {{recipient_name}}، الفاتورة رقم {{invoice_number}} بمبلغ {{amount}} {{currency}} تجاوزت تاريخ الاستحقاق {{due_date}}.',
  true, true, 'platform',
  '{"invoice_number":{"label_ar":"رقم الفاتورة","label_en":"Invoice Number","example":"INV-2026-001"},"amount":{"label_ar":"المبلغ","label_en":"Amount","example":"5,000.00"},"currency":{"label_ar":"العملة","label_en":"Currency","example":"ر.س"},"due_date":{"label_ar":"تاريخ الاستحقاق","label_en":"Due Date","example":"2026-02-28"},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"أحمد محمد"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"شركة المثال"},"cta_url":{"label_ar":"رابط الإجراء","label_en":"CTA URL","example":"#"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 4) payment_failed - EN
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'invoice_overdue', 'email', 'en',
  'Overdue Invoice: {{invoice_number}}',
  'Overdue Invoice',
  'Invoice #{{invoice_number}} for {{amount}} {{currency}} is past due.',
  '<!DOCTYPE html><html dir="ltr" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Inter,"Segoe UI",system-ui,sans-serif;direction:ltr}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:2px solid #ef4444}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.alert{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin:16px 0}.alert p{margin:0;font-size:13px;color:#991b1b;font-weight:500}.tbl{width:100%;border-collapse:collapse;margin:16px 0}.tbl td{padding:10px 0;font-size:13px;border-bottom:1px solid #f3f4f6}.tbl td:last-child{text-align:right;font-weight:600;color:#111827}.cta{display:inline-block;background:#111827;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><h1>Overdue Invoice</h1><p style="margin:4px 0 0;font-size:13px;color:#6b7280">{{company_name}}</p></div><div class="bd"><div class="alert"><p>⚠️ This invoice is past due</p></div><p>Hello {{recipient_name}},</p><p>We would like to inform you that the following invoice has not been paid by its due date:</p><table class="tbl"><tr><td>Invoice Number</td><td>{{invoice_number}}</td></tr><tr><td>Amount</td><td>{{amount}} {{currency}}</td></tr><tr><td>Due Date</td><td>{{due_date}}</td></tr></table><p style="text-align:center"><a class="cta" href="{{cta_url}}">Pay Invoice</a></p></div><div class="ft"><p>{{company_name}}</p><p>This is an automated message — no reply required</p></div></div></div></body></html>',
  'Hello {{recipient_name}}, Invoice #{{invoice_number}} for {{amount}} {{currency}} is past due since {{due_date}}.',
  true, true, 'platform',
  '{"invoice_number":{"label_ar":"رقم الفاتورة","label_en":"Invoice Number","example":"INV-2026-001"},"amount":{"label_ar":"المبلغ","label_en":"Amount","example":"5,000.00"},"currency":{"label_ar":"العملة","label_en":"Currency","example":"SAR"},"due_date":{"label_ar":"تاريخ الاستحقاق","label_en":"Due Date","example":"2026-02-28"},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"Ahmed Mohammed"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"Example Corp"},"cta_url":{"label_ar":"رابط الإجراء","label_en":"CTA URL","example":"#"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 5) approval_requested - AR
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'approval_requested', 'email', 'ar',
  'طلب موافقة: {{document_type}} {{document_number}}',
  'طلب موافقة جديد',
  'مطلوب موافقتك على {{document_type}} رقم {{document_number}} بمبلغ {{amount}} {{currency}}.',
  '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Tajawal,"Segoe UI",Tahoma,sans-serif;direction:rtl}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:1px solid #f3f4f6}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.info{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin:16px 0}.info p{margin:0;font-size:13px;color:#1e40af}.tbl{width:100%;border-collapse:collapse;margin:16px 0}.tbl td{padding:10px 0;font-size:13px;border-bottom:1px solid #f3f4f6}.tbl td:last-child{text-align:left;font-weight:600;color:#111827}.cta{display:inline-block;background:#111827;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><h1>طلب موافقة</h1><p style="margin:4px 0 0;font-size:13px;color:#6b7280">{{company_name}}</p></div><div class="bd"><div class="info"><p>📋 مطلوب موافقتك على مستند جديد</p></div><p>مرحباً {{recipient_name}}،</p><p>تم تقديم طلب موافقة يتطلب مراجعتك:</p><table class="tbl"><tr><td>نوع المستند</td><td>{{document_type}}</td></tr><tr><td>الرقم</td><td>{{document_number}}</td></tr><tr><td>المبلغ</td><td>{{amount}} {{currency}}</td></tr><tr><td>مقدم الطلب</td><td>{{requester_name}}</td></tr></table><p style="text-align:center"><a class="cta" href="{{cta_url}}">مراجعة الطلب</a></p></div><div class="ft"><p>{{company_name}}</p><p>هذه رسالة آلية — لا تتطلب رداً</p></div></div></div></body></html>',
  'مرحباً {{recipient_name}}، مطلوب موافقتك على {{document_type}} رقم {{document_number}} بمبلغ {{amount}} {{currency}}.',
  true, true, 'platform',
  '{"document_type":{"label_ar":"نوع المستند","label_en":"Document Type","example":"فاتورة"},"document_number":{"label_ar":"رقم المستند","label_en":"Document Number","example":"INV-2026-001"},"amount":{"label_ar":"المبلغ","label_en":"Amount","example":"5,000.00"},"currency":{"label_ar":"العملة","label_en":"Currency","example":"ر.س"},"requester_name":{"label_ar":"مقدم الطلب","label_en":"Requester","example":"سعد العتيبي"},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"أحمد محمد"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"شركة المثال"},"cta_url":{"label_ar":"رابط الإجراء","label_en":"CTA URL","example":"#"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 5) approval_requested - EN
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'approval_requested', 'email', 'en',
  'Approval Required: {{document_type}} {{document_number}}',
  'New Approval Request',
  'Your approval is required for {{document_type}} #{{document_number}} ({{amount}} {{currency}}).',
  '<!DOCTYPE html><html dir="ltr" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Inter,"Segoe UI",system-ui,sans-serif;direction:ltr}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:1px solid #f3f4f6}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.info{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin:16px 0}.info p{margin:0;font-size:13px;color:#1e40af}.tbl{width:100%;border-collapse:collapse;margin:16px 0}.tbl td{padding:10px 0;font-size:13px;border-bottom:1px solid #f3f4f6}.tbl td:last-child{text-align:right;font-weight:600;color:#111827}.cta{display:inline-block;background:#111827;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><h1>Approval Request</h1><p style="margin:4px 0 0;font-size:13px;color:#6b7280">{{company_name}}</p></div><div class="bd"><div class="info"><p>📋 Your approval is required for a new document</p></div><p>Hello {{recipient_name}},</p><p>An approval request has been submitted that requires your review:</p><table class="tbl"><tr><td>Document Type</td><td>{{document_type}}</td></tr><tr><td>Number</td><td>{{document_number}}</td></tr><tr><td>Amount</td><td>{{amount}} {{currency}}</td></tr><tr><td>Requested By</td><td>{{requester_name}}</td></tr></table><p style="text-align:center"><a class="cta" href="{{cta_url}}">Review Request</a></p></div><div class="ft"><p>{{company_name}}</p><p>This is an automated message — no reply required</p></div></div></div></body></html>',
  'Hello {{recipient_name}}, your approval is required for {{document_type}} #{{document_number}} ({{amount}} {{currency}}).',
  true, true, 'platform',
  '{"document_type":{"label_ar":"نوع المستند","label_en":"Document Type","example":"Invoice"},"document_number":{"label_ar":"رقم المستند","label_en":"Document Number","example":"INV-2026-001"},"amount":{"label_ar":"المبلغ","label_en":"Amount","example":"5,000.00"},"currency":{"label_ar":"العملة","label_en":"Currency","example":"SAR"},"requester_name":{"label_ar":"مقدم الطلب","label_en":"Requester","example":"Saad Al-Otaibi"},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"Ahmed Mohammed"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"Example Corp"},"cta_url":{"label_ar":"رابط الإجراء","label_en":"CTA URL","example":"#"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 6) generic_announcement - AR
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'leave_request_approved', 'email', 'ar',
  '{{title}}',
  '{{title}}',
  '{{message}}',
  '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Tajawal,"Segoe UI",Tahoma,sans-serif;direction:rtl}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:1px solid #f3f4f6}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.hdr p{margin:6px 0 0;font-size:13px;color:#6b7280}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.cta{display:inline-block;background:#111827;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><h1>{{title}}</h1><p>{{company_name}}</p></div><div class="bd"><p>مرحباً {{recipient_name}}،</p><p>{{message}}</p><p style="text-align:center"><a class="cta" href="{{cta_url}}">{{cta_label}}</a></p></div><div class="ft"><p>{{company_name}}</p><p>هذه رسالة آلية — لا تتطلب رداً</p></div></div></div></body></html>',
  'مرحباً {{recipient_name}}، {{message}}',
  true, true, 'platform',
  '{"title":{"label_ar":"العنوان","label_en":"Title","example":"تم قبول طلب الإجازة"},"message":{"label_ar":"الرسالة","label_en":"Message","example":"تمت الموافقة على طلب إجازتك."},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"أحمد محمد"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"شركة المثال"},"cta_url":{"label_ar":"رابط الإجراء","label_en":"CTA URL","example":"#"},"cta_label":{"label_ar":"نص الزر","label_en":"Button Text","example":"عرض التفاصيل"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- 6) generic_announcement - EN  
INSERT INTO public.notification_event_templates (event_key, channel, lang, subject, title, body, body_html, body_text, is_platform_default, is_active, scope, variables_schema)
VALUES (
  'leave_request_approved', 'email', 'en',
  '{{title}}',
  '{{title}}',
  '{{message}}',
  '<!DOCTYPE html><html dir="ltr" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;background:#f8f9fa;font-family:Inter,"Segoe UI",system-ui,sans-serif;direction:ltr}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:24px 16px}.card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}.hdr{padding:24px 28px;border-bottom:1px solid #f3f4f6}.hdr h1{margin:0;font-size:18px;font-weight:700;color:#111827}.hdr p{margin:6px 0 0;font-size:13px;color:#6b7280}.bd{padding:28px}.bd p{margin:0 0 16px;font-size:14px;line-height:1.9;color:#374151}.cta{display:inline-block;background:#111827;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}.ft{padding:20px 28px;text-align:center}.ft p{margin:0;font-size:11px;color:#9ca3af;line-height:1.8}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><h1>{{title}}</h1><p>{{company_name}}</p></div><div class="bd"><p>Hello {{recipient_name}},</p><p>{{message}}</p><p style="text-align:center"><a class="cta" href="{{cta_url}}">{{cta_label}}</a></p></div><div class="ft"><p>{{company_name}}</p><p>This is an automated message — no reply required</p></div></div></div></body></html>',
  'Hello {{recipient_name}}, {{message}}',
  true, true, 'platform',
  '{"title":{"label_ar":"العنوان","label_en":"Title","example":"Leave Request Approved"},"message":{"label_ar":"الرسالة","label_en":"Message","example":"Your leave request has been approved."},"recipient_name":{"label_ar":"اسم المستلم","label_en":"Recipient","example":"Ahmed Mohammed"},"company_name":{"label_ar":"اسم الشركة","label_en":"Company","example":"Example Corp"},"cta_url":{"label_ar":"رابط الإجراء","label_en":"CTA URL","example":"#"},"cta_label":{"label_ar":"نص الزر","label_en":"Button Text","example":"View Details"}}'::jsonb
) ON CONFLICT DO NOTHING;

-- =============================================
-- RPC: resolve_template — deterministic resolution
-- =============================================
CREATE OR REPLACE FUNCTION public.resolve_template(
  p_event_key TEXT,
  p_channel TEXT,
  p_lang TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_result JSONB;
BEGIN
  -- 1) Try tenant override first
  IF p_tenant_id IS NOT NULL THEN
    SELECT * INTO v_template
    FROM notification_event_templates
    WHERE scope = 'tenant'
      AND tenant_id = p_tenant_id
      AND event_key = p_event_key
      AND channel = p_channel
      AND lang = p_lang
      AND is_active = true
    ORDER BY version DESC
    LIMIT 1;
    
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_template.id,
        'scope', 'tenant',
        'subject', v_template.subject,
        'title', v_template.title,
        'body_html', v_template.body_html,
        'body_text', COALESCE(v_template.body_text, v_template.body),
        'body', v_template.body,
        'variables_schema', v_template.variables_schema,
        'version', v_template.version,
        'lang', v_template.lang
      );
    END IF;
  END IF;

  -- 2) Platform default
  SELECT * INTO v_template
  FROM notification_event_templates
  WHERE scope = 'platform'
    AND event_key = p_event_key
    AND channel = p_channel
    AND lang = p_lang
    AND is_active = true
  ORDER BY version DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_template.id,
      'scope', 'platform',
      'subject', v_template.subject,
      'title', v_template.title,
      'body_html', v_template.body_html,
      'body_text', COALESCE(v_template.body_text, v_template.body),
      'body', v_template.body,
      'variables_schema', v_template.variables_schema,
      'version', v_template.version,
      'lang', v_template.lang
    );
  END IF;

  -- 3) Fallback to en if requested lang not found
  IF p_lang <> 'en' THEN
    SELECT * INTO v_template
    FROM notification_event_templates
    WHERE scope = 'platform'
      AND event_key = p_event_key
      AND channel = p_channel
      AND lang = 'en'
      AND is_active = true
    ORDER BY version DESC
    LIMIT 1;
    
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_template.id,
        'scope', 'platform',
        'subject', v_template.subject,
        'title', v_template.title,
        'body_html', v_template.body_html,
        'body_text', COALESCE(v_template.body_text, v_template.body),
        'body', v_template.body,
        'variables_schema', v_template.variables_schema,
        'version', v_template.version,
        'lang', 'en'
      );
    END IF;
  END IF;

  -- 4) Nothing found
  RETURN NULL;
END;
$$;
