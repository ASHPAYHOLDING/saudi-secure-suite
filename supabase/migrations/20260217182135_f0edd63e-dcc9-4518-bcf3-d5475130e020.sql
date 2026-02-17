
-- ═══════════════════════════════════════════════
-- Email Template Engine: Definitions + Versions + Tenant Overrides
-- ═══════════════════════════════════════════════

-- 1. Platform-level email template definitions (managed by super admin)
CREATE TABLE public.email_template_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general', -- general, financial, security, notification
  subject_template TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{key: "company_name", label_ar: "اسم الشركة", label_en: "Company Name", default: ""}]
  sender_key TEXT NOT NULL DEFAULT 'no-reply', -- no-reply, billing, security
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false, -- system templates cannot be deleted
  allow_tenant_override BOOLEAN NOT NULL DEFAULT true,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Version history for each template
CREATE TABLE public.email_template_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.email_template_definitions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  subject_template TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  change_summary TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, version_number)
);

-- 3. Tenant-level overrides (per-tenant customization)
CREATE TABLE public.tenant_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.email_template_definitions(id) ON DELETE CASCADE,
  subject_template TEXT,
  body_html TEXT,
  body_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, template_id)
);

-- Indexes
CREATE INDEX idx_email_tpl_def_type ON public.email_template_definitions(email_type);
CREATE INDEX idx_email_tpl_def_category ON public.email_template_definitions(category);
CREATE INDEX idx_email_tpl_ver_template ON public.email_template_versions(template_id);
CREATE INDEX idx_tenant_email_tpl_tenant ON public.tenant_email_templates(tenant_id);
CREATE INDEX idx_tenant_email_tpl_template ON public.tenant_email_templates(template_id);

-- RLS for email_template_definitions
ALTER TABLE public.email_template_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage definitions"
  ON public.email_template_definitions FOR ALL
  USING (public.is_platform_admin());

CREATE POLICY "Authenticated users can read active definitions"
  ON public.email_template_definitions FOR SELECT
  USING (is_active = true);

-- RLS for email_template_versions
ALTER TABLE public.email_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage versions"
  ON public.email_template_versions FOR ALL
  USING (public.is_platform_admin());

CREATE POLICY "Authenticated users can read versions"
  ON public.email_template_versions FOR SELECT
  USING (true);

-- RLS for tenant_email_templates
ALTER TABLE public.tenant_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins view all tenant templates"
  ON public.tenant_email_templates FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Tenant admins manage own templates"
  ON public.tenant_email_templates FOR ALL
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

-- Auto-update updated_at
CREATE TRIGGER update_email_tpl_def_updated_at
  BEFORE UPDATE ON public.email_template_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_email_tpl_updated_at
  BEFORE UPDATE ON public.tenant_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create version on template update
CREATE OR REPLACE FUNCTION public.auto_version_email_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only version if body changed
  IF OLD.body_html IS DISTINCT FROM NEW.body_html 
     OR OLD.subject_template IS DISTINCT FROM NEW.subject_template THEN
    
    NEW.current_version := OLD.current_version + 1;
    
    INSERT INTO public.email_template_versions (
      template_id, version_number, subject_template, body_html, body_text, 
      change_summary, changed_by
    ) VALUES (
      NEW.id, NEW.current_version, NEW.subject_template, NEW.body_html, NEW.body_text,
      'تحديث القالب', NEW.updated_by
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_version_email_template
  BEFORE UPDATE ON public.email_template_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_version_email_template();

-- Function to resolve template for a given email_type + tenant
CREATE OR REPLACE FUNCTION public.resolve_email_template(_email_type TEXT, _tenant_id UUID DEFAULT NULL)
RETURNS TABLE(
  subject_template TEXT,
  body_html TEXT,
  body_text TEXT,
  sender_key TEXT,
  variables JSONB
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _def RECORD;
  _override RECORD;
BEGIN
  -- Get platform default
  SELECT * INTO _def
  FROM public.email_template_definitions
  WHERE email_type = _email_type AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check for tenant override
  IF _tenant_id IS NOT NULL AND _def.allow_tenant_override THEN
    SELECT * INTO _override
    FROM public.tenant_email_templates
    WHERE template_id = _def.id AND tenant_id = _tenant_id AND is_active = true;
    
    IF FOUND THEN
      RETURN QUERY SELECT
        COALESCE(_override.subject_template, _def.subject_template),
        COALESCE(_override.body_html, _def.body_html),
        COALESCE(_override.body_text, _def.body_text),
        _def.sender_key,
        _def.variables;
      RETURN;
    END IF;
  END IF;
  
  -- Return platform default
  RETURN QUERY SELECT
    _def.subject_template,
    _def.body_html,
    _def.body_text,
    _def.sender_key,
    _def.variables;
END;
$$;

-- Seed default financial email templates
INSERT INTO public.email_template_definitions (email_type, name_ar, name_en, description, category, subject_template, body_html, body_text, variables, sender_key, is_system, is_active, current_version) VALUES

('financial_invoice', 'فاتورة ضريبية', 'Tax Invoice', 'يُرسل عند إصدار فاتورة جديدة', 'financial',
 'فاتورة ضريبية رقم {{invoice_number}} – {{company_name}}',
 '<p>السيد/ة <strong>{{customer_name}}</strong> المحترم/ة،</p><p>نفيدكم بأنه تم إصدار فاتورة ضريبية على حسابكم وفقاً للبيانات التالية:</p><table class="data-table"><tr><td>رقم الفاتورة</td><td class="num">{{invoice_number}}</td></tr><tr><td>تاريخ الإصدار</td><td class="num">{{invoice_date}}</td></tr><tr><td>تاريخ الاستحقاق</td><td class="num">{{due_date}}</td></tr><tr><td>المبلغ قبل الضريبة</td><td class="num">{{subtotal}} {{currency}}</td></tr><tr><td>ضريبة القيمة المضافة</td><td class="num">{{vat_total}} {{currency}}</td></tr></table><div class="amount-box"><p class="amount num">{{grand_total}} {{currency}}</p><p class="label">إجمالي المبلغ المستحق</p></div>',
 'فاتورة ضريبية رقم {{invoice_number}} بمبلغ {{grand_total}} {{currency}} مستحقة بتاريخ {{due_date}}',
 '[{"key":"company_name","label_ar":"اسم الشركة","label_en":"Company Name"},{"key":"vat_number","label_ar":"الرقم الضريبي","label_en":"VAT Number"},{"key":"cr_number","label_ar":"السجل التجاري","label_en":"CR Number"},{"key":"customer_name","label_ar":"اسم العميل","label_en":"Customer Name"},{"key":"invoice_number","label_ar":"رقم الفاتورة","label_en":"Invoice Number"},{"key":"invoice_date","label_ar":"تاريخ الإصدار","label_en":"Invoice Date"},{"key":"due_date","label_ar":"تاريخ الاستحقاق","label_en":"Due Date"},{"key":"subtotal","label_ar":"المبلغ قبل الضريبة","label_en":"Subtotal"},{"key":"vat_total","label_ar":"الضريبة","label_en":"VAT"},{"key":"grand_total","label_ar":"الإجمالي","label_en":"Grand Total"},{"key":"currency","label_ar":"العملة","label_en":"Currency"},{"key":"access_token","label_ar":"رمز الوصول","label_en":"Access Token"}]'::jsonb,
 'billing', true, true, 1),

('financial_payment_receipt', 'إيصال دفع', 'Payment Receipt', 'يُرسل عند استلام دفعة', 'financial',
 'إيصال دفع – {{amount}} {{currency}} – {{company_name}}',
 '<p>السيد/ة <strong>{{customer_name}}</strong> المحترم/ة،</p><p>نؤكد لكم استلام الدفعة المالية التالية بنجاح:</p><div class="success-box"><p class="amount num">{{amount}} {{currency}}</p><p class="label">✓ تم الاستلام بنجاح</p></div><table class="data-table"><tr><td>رقم الفاتورة المرتبطة</td><td class="num">{{invoice_number}}</td></tr><tr><td>تاريخ الدفع</td><td class="num">{{payment_date}}</td></tr><tr><td>طريقة الدفع</td><td>{{payment_method}}</td></tr><tr><td>الرصيد المتبقي</td><td class="num">{{remaining_balance}} {{currency}}</td></tr></table>',
 'تم استلام دفعة بمبلغ {{amount}} {{currency}} للفاتورة {{invoice_number}}',
 '[{"key":"company_name","label_ar":"اسم الشركة","label_en":"Company Name"},{"key":"vat_number","label_ar":"الرقم الضريبي","label_en":"VAT Number"},{"key":"customer_name","label_ar":"اسم العميل","label_en":"Customer Name"},{"key":"invoice_number","label_ar":"رقم الفاتورة","label_en":"Invoice Number"},{"key":"amount","label_ar":"المبلغ","label_en":"Amount"},{"key":"currency","label_ar":"العملة","label_en":"Currency"},{"key":"payment_date","label_ar":"تاريخ الدفع","label_en":"Payment Date"},{"key":"payment_method","label_ar":"طريقة الدفع","label_en":"Payment Method"},{"key":"reference_number","label_ar":"رقم المرجع","label_en":"Reference"},{"key":"remaining_balance","label_ar":"الرصيد المتبقي","label_en":"Remaining Balance"}]'::jsonb,
 'billing', true, true, 1),

('financial_payment_failed', 'فشل عملية دفع', 'Payment Failed', 'يُرسل عند فشل عملية دفع', 'financial',
 '⚠ فشل عملية دفع – {{company_name}}',
 '<p>السيد/ة <strong>{{customer_name}}</strong> المحترم/ة،</p><p>نأسف لإبلاغكم بفشل عملية الدفع التالية:</p><div class="error-box"><p class="amount num">{{amount}} {{currency}}</p><p class="label">✗ فشلت العملية</p></div><table class="data-table"><tr><td>رقم الفاتورة</td><td class="num">{{invoice_number}}</td></tr><tr><td>تاريخ المحاولة</td><td class="num">{{attempt_date}}</td></tr><tr><td>سبب الفشل</td><td>{{failure_reason}}</td></tr></table><p>يُرجى التحقق من بيانات الدفع والمحاولة مرة أخرى.</p>',
 'فشلت عملية دفع بمبلغ {{amount}} {{currency}} للفاتورة {{invoice_number}}. السبب: {{failure_reason}}',
 '[{"key":"company_name","label_ar":"اسم الشركة","label_en":"Company Name"},{"key":"customer_name","label_ar":"اسم العميل","label_en":"Customer Name"},{"key":"invoice_number","label_ar":"رقم الفاتورة","label_en":"Invoice Number"},{"key":"amount","label_ar":"المبلغ","label_en":"Amount"},{"key":"currency","label_ar":"العملة","label_en":"Currency"},{"key":"attempt_date","label_ar":"تاريخ المحاولة","label_en":"Attempt Date"},{"key":"failure_reason","label_ar":"سبب الفشل","label_en":"Failure Reason"}]'::jsonb,
 'billing', true, true, 1),

('financial_refund', 'إشعار استرداد', 'Refund Notice', 'يُرسل عند إصدار إشعار دائن', 'financial',
 'إشعار استرداد رقم {{credit_note_number}} – {{company_name}}',
 '<p>السيد/ة <strong>{{customer_name}}</strong> المحترم/ة،</p><p>نفيدكم بصدور إشعار دائن (استرداد) على حسابكم:</p><table class="data-table"><tr><td>رقم الإشعار الدائن</td><td class="num">{{credit_note_number}}</td></tr><tr><td>تاريخ الإصدار</td><td class="num">{{credit_date}}</td></tr><tr><td>سبب الاسترداد</td><td>{{reason}}</td></tr><tr><td>المبلغ قبل الضريبة</td><td class="num">{{subtotal}} {{currency}}</td></tr><tr><td>الضريبة</td><td class="num">{{vat_total}} {{currency}}</td></tr></table><div class="success-box"><p class="amount num">{{grand_total}} {{currency}}</p><p class="label">إجمالي مبلغ الاسترداد</p></div>',
 'إشعار استرداد رقم {{credit_note_number}} بمبلغ {{grand_total}} {{currency}}',
 '[{"key":"company_name","label_ar":"اسم الشركة","label_en":"Company Name"},{"key":"vat_number","label_ar":"الرقم الضريبي","label_en":"VAT Number"},{"key":"customer_name","label_ar":"اسم العميل","label_en":"Customer Name"},{"key":"credit_note_number","label_ar":"رقم الإشعار","label_en":"Credit Note Number"},{"key":"credit_date","label_ar":"التاريخ","label_en":"Date"},{"key":"reason","label_ar":"السبب","label_en":"Reason"},{"key":"subtotal","label_ar":"المبلغ قبل الضريبة","label_en":"Subtotal"},{"key":"vat_total","label_ar":"الضريبة","label_en":"VAT"},{"key":"grand_total","label_ar":"الإجمالي","label_en":"Grand Total"},{"key":"currency","label_ar":"العملة","label_en":"Currency"},{"key":"access_token","label_ar":"رمز الوصول","label_en":"Access Token"}]'::jsonb,
 'billing', true, true, 1),

('financial_wallet_notification', 'إشعار رصيد المحفظة', 'Wallet Notification', 'يُرسل عند عمليات المحفظة', 'financial',
 'إشعار {{transaction_type_label}} في المحفظة – {{company_name}}',
 '<p>تم تنفيذ عملية {{transaction_type_label}} في محفظة المنشأة:</p><div class="amount-box"><p class="amount num">{{amount_sign}}{{amount}} ر.س</p><p class="label">{{transaction_type_label}}</p></div><table class="data-table"><tr><td>نوع العملية</td><td>{{transaction_type_label}}</td></tr><tr><td>السبب</td><td>{{reason_label}}</td></tr><tr><td>الرصيد السابق</td><td class="num">{{balance_before}} ر.س</td></tr><tr><td>الرصيد الحالي</td><td class="num">{{balance_after}} ر.س</td></tr></table>',
 'عملية {{transaction_type_label}} بمبلغ {{amount}} ر.س. الرصيد الحالي: {{balance_after}} ر.س',
 '[{"key":"company_name","label_ar":"اسم الشركة","label_en":"Company Name"},{"key":"transaction_type_label","label_ar":"نوع العملية","label_en":"Transaction Type"},{"key":"amount","label_ar":"المبلغ","label_en":"Amount"},{"key":"amount_sign","label_ar":"إشارة المبلغ","label_en":"Sign"},{"key":"balance_before","label_ar":"الرصيد السابق","label_en":"Balance Before"},{"key":"balance_after","label_ar":"الرصيد الحالي","label_en":"Balance After"},{"key":"reason_label","label_ar":"السبب","label_en":"Reason"}]'::jsonb,
 'billing', true, true, 1),

('account_activation', 'تفعيل الحساب', 'Account Activation', 'يُرسل عند إنشاء حساب جديد', 'general',
 'تفعيل حسابك – Numaxio',
 '<p>مرحباً <strong>{{user_name}}</strong>،</p><p>تم إنشاء حسابك بنجاح. يمكنك الآن تسجيل الدخول والبدء في استخدام المنصة.</p>',
 'مرحباً {{user_name}}، تم إنشاء حسابك بنجاح.',
 '[{"key":"user_name","label_ar":"اسم المستخدم","label_en":"User Name"}]'::jsonb,
 'no-reply', true, true, 1),

('security_alert', 'تنبيه أمني', 'Security Alert', 'يُرسل عند تسجيل دخول مشبوه', 'security',
 '⚠️ تنبيه أمني – Numaxio',
 '<p>تم تسجيل دخول جديد إلى حسابك.</p><div class="warning-box"><p class="amount">📍 {{ip_address}} • {{device}}</p><p class="label">{{timestamp}}</p></div><p>إذا لم تكن أنت، قم بتغيير كلمة المرور فوراً.</p>',
 'تم تسجيل دخول جديد إلى حسابك من {{ip_address}}. إذا لم تكن أنت، قم بتغيير كلمة المرور فوراً.',
 '[{"key":"ip_address","label_ar":"عنوان IP","label_en":"IP Address"},{"key":"device","label_ar":"الجهاز","label_en":"Device"},{"key":"timestamp","label_ar":"الوقت","label_en":"Timestamp"},{"key":"alert_type","label_ar":"نوع التنبيه","label_en":"Alert Type"}]'::jsonb,
 'security', true, true, 1);

-- Create initial version records for all seeded templates
INSERT INTO public.email_template_versions (template_id, version_number, subject_template, body_html, body_text, change_summary, changed_by)
SELECT id, 1, subject_template, body_html, body_text, 'الإصدار الأولي', created_by
FROM public.email_template_definitions;
