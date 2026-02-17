
-- ═══════════════════════════════════════════════════════════
-- ❶ Add missing email templates (subscription, integration, activation already exists)
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.email_template_definitions (email_type, name_ar, name_en, description, category, subject_template, body_html, body_text, variables, sender_key, is_active, is_system, allow_tenant_override)
VALUES
(
  'subscription_confirmation',
  'تأكيد اشتراك',
  'Subscription Confirmation',
  'يُرسل عند تفعيل اشتراك جديد أو ترقية',
  'financial',
  'تأكيد اشتراكك في خطة {{plan_name}}',
  '<div dir="rtl" style="font-family:''IBM Plex Sans Arabic'',sans-serif;line-height:1.8;color:#1e293b;"><h2 style="margin:0 0 16px;font-size:18px;">تأكيد الاشتراك</h2><p>مرحباً <strong>{{company_name}}</strong>،</p><p>تم تفعيل اشتراكك في خطة <strong>{{plan_name}}</strong> بنجاح.</p><table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;"><tr style="background:#f8fafc;"><td style="padding:10px 12px;border:1px solid #e2e8f0;">الخطة</td><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:600;">{{plan_name}}</td></tr><tr><td style="padding:10px 12px;border:1px solid #e2e8f0;">الدورة</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{billing_cycle}}</td></tr><tr style="background:#f8fafc;"><td style="padding:10px 12px;border:1px solid #e2e8f0;">تاريخ البدء</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{start_date}}</td></tr><tr><td style="padding:10px 12px;border:1px solid #e2e8f0;">تاريخ الانتهاء</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{end_date}}</td></tr></table><p style="font-size:13px;color:#64748b;">شكراً لاختياركم نيوماكسيو.</p></div>',
  'تأكيد اشتراكك في خطة {{plan_name}} — من {{start_date}} إلى {{end_date}}',
  '[{"key":"company_name","label_ar":"اسم المنشأة","label_en":"Company Name"},{"key":"plan_name","label_ar":"اسم الخطة","label_en":"Plan Name"},{"key":"billing_cycle","label_ar":"دورة الفوترة","label_en":"Billing Cycle"},{"key":"start_date","label_ar":"تاريخ البدء","label_en":"Start Date"},{"key":"end_date","label_ar":"تاريخ الانتهاء","label_en":"End Date"}]'::jsonb,
  'billing', true, true, true
),
(
  'integration_activated',
  'تفعيل تكامل',
  'Integration Activated',
  'يُرسل عند تفعيل تكامل خارجي بنجاح',
  'general',
  'تم تفعيل {{integration_name}} بنجاح',
  '<div dir="rtl" style="font-family:''IBM Plex Sans Arabic'',sans-serif;line-height:1.8;color:#1e293b;"><h2 style="margin:0 0 16px;font-size:18px;">تم تفعيل التكامل</h2><p>مرحباً <strong>{{company_name}}</strong>،</p><p>تم تفعيل تكامل <strong>{{integration_name}}</strong> بنجاح على حسابكم.</p><p style="font-size:14px;">نوع التكامل: <strong>{{integration_type}}</strong></p><p style="font-size:13px;color:#64748b;margin-top:16px;">يمكنك إدارة التكاملات من إعدادات المنشأة.</p></div>',
  'تم تفعيل {{integration_name}} ({{integration_type}}) بنجاح على حساب {{company_name}}.',
  '[{"key":"company_name","label_ar":"اسم المنشأة","label_en":"Company Name"},{"key":"integration_name","label_ar":"اسم التكامل","label_en":"Integration Name"},{"key":"integration_type","label_ar":"نوع التكامل","label_en":"Integration Type"}]'::jsonb,
  'no-reply', true, true, true
)
ON CONFLICT (email_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- ❷ Trigger functions for missing events
-- ═══════════════════════════════════════════════════════════

-- ── UserCreated → Activation email ──
CREATE OR REPLACE FUNCTION public.fire_activation_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  -- fires on profiles insert (created by handle_new_user trigger)
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    INSERT INTO public.email_logs (
      tenant_id, user_id, email_type, sender_address, recipient_email,
      subject, status, entity_type, entity_id, metadata
    ) VALUES (
      NEW.tenant_id, NEW.id,
      'account_activation', 'no-reply@numaxio.com', NEW.email,
      'مرحباً بك في نيوماكسيو', 'queued',
      'profile', NEW.id,
      jsonb_build_object(
        'user_name', COALESCE(NEW.full_name, ''),
        'company_name', 'نيوماكسيو'
      )
    );
  END IF;
  RETURN NEW;
END;
$fn$;


-- ── SubscriptionPurchased → Confirmation email ──
CREATE OR REPLACE FUNCTION public.fire_subscription_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  _tenant RECORD;
  _plan RECORD;
  _owner RECORD;
  _profile RECORD;
BEGIN
  -- Fire when status changes to 'active' (new purchase or upgrade)
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO _tenant FROM public.tenants WHERE id = NEW.tenant_id;
    SELECT * INTO _plan FROM public.subscription_plans WHERE id = NEW.plan_id;
    
    SELECT * INTO _owner FROM public.tenant_members
    WHERE tenant_id = NEW.tenant_id AND role = 'owner' LIMIT 1;
    
    IF _owner IS NOT NULL THEN
      SELECT * INTO _profile FROM public.profiles WHERE id = _owner.user_id;
      
      IF _profile.email IS NOT NULL AND _profile.email <> '' THEN
        INSERT INTO public.email_logs (
          tenant_id, user_id, email_type, sender_address, recipient_email,
          subject, status, entity_type, entity_id, metadata
        ) VALUES (
          NEW.tenant_id, _owner.user_id,
          'subscription_confirmation', 'billing@numaxio.com', _profile.email,
          'تأكيد اشتراكك في خطة ' || COALESCE(_plan.name_ar, ''),
          'queued', 'subscription', NEW.id,
          jsonb_build_object(
            'company_name', _tenant.name,
            'plan_name', COALESCE(_plan.name_ar, ''),
            'billing_cycle', NEW.billing_cycle,
            'start_date', NEW.current_period_start,
            'end_date', NEW.current_period_end
          )
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;


-- ── IntegrationActivated → Success notice ──
CREATE OR REPLACE FUNCTION public.fire_integration_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  _tenant RECORD;
  _owner RECORD;
  _profile RECORD;
BEGIN
  -- Fire when integration is enabled
  IF NEW.is_enabled = true AND (OLD.is_enabled IS DISTINCT FROM NEW.is_enabled) THEN
    SELECT * INTO _tenant FROM public.tenants WHERE id = NEW.tenant_id;
    
    SELECT * INTO _owner FROM public.tenant_members
    WHERE tenant_id = NEW.tenant_id AND role = 'owner' LIMIT 1;
    
    IF _owner IS NOT NULL THEN
      SELECT * INTO _profile FROM public.profiles WHERE id = _owner.user_id;
      
      IF _profile.email IS NOT NULL AND _profile.email <> '' THEN
        INSERT INTO public.email_logs (
          tenant_id, user_id, email_type, sender_address, recipient_email,
          subject, status, entity_type, entity_id, metadata
        ) VALUES (
          NEW.tenant_id, _owner.user_id,
          'integration_activated', 'no-reply@numaxio.com', _profile.email,
          'تم تفعيل ' || COALESCE(NEW.display_name, NEW.integration_type),
          'queued', 'integration', NEW.id,
          jsonb_build_object(
            'company_name', _tenant.name,
            'integration_name', COALESCE(NEW.display_name, NEW.integration_type),
            'integration_type', NEW.integration_type
          )
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;


-- ── SecurityEvent (account lock) → Alert ──
CREATE OR REPLACE FUNCTION public.fire_security_alert_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  _profile RECORD;
BEGIN
  IF NEW.is_active = true THEN
    SELECT * INTO _profile FROM public.profiles WHERE id = NEW.user_id;
    
    IF _profile.email IS NOT NULL AND _profile.email <> '' THEN
      INSERT INTO public.email_logs (
        tenant_id, user_id, email_type, sender_address, recipient_email,
        subject, status, entity_type, entity_id, metadata
      ) VALUES (
        _profile.tenant_id, NEW.user_id,
        'security_alert', 'security@numaxio.com', _profile.email,
        'تنبيه أمني – تم قفل حسابك',
        'queued', 'account_lock', NEW.id,
        jsonb_build_object(
          'user_name', COALESCE(_profile.full_name, ''),
          'alert_type', 'account_locked',
          'reason', COALESCE(NEW.reason, 'غير محدد'),
          'timestamp', NEW.locked_at,
          'company_name', 'نيوماكسيو'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;


-- ═══════════════════════════════════════════════════════════
-- ❸ Attach ALL triggers (existing functions + new ones)
-- ═══════════════════════════════════════════════════════════

-- Drop existing triggers if any to avoid duplicates
DROP TRIGGER IF EXISTS trg_fire_invoice_email ON public.invoices;
DROP TRIGGER IF EXISTS trg_fire_payment_receipt_email ON public.invoice_payments;
DROP TRIGGER IF EXISTS trg_fire_wallet_balance_email ON public.wallet_transactions;
DROP TRIGGER IF EXISTS trg_fire_credit_note_email ON public.credit_notes;
DROP TRIGGER IF EXISTS trg_fire_activation_email ON public.profiles;
DROP TRIGGER IF EXISTS trg_fire_subscription_email ON public.subscriptions;
DROP TRIGGER IF EXISTS trg_fire_integration_email ON public.tenant_integrations;
DROP TRIGGER IF EXISTS trg_fire_security_alert_email ON public.account_locks;

-- InvoiceCreated/Updated → Invoice email
CREATE TRIGGER trg_fire_invoice_email
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fire_invoice_email();

-- PaymentSuccess → Receipt email
CREATE TRIGGER trg_fire_payment_receipt_email
AFTER INSERT ON public.invoice_payments
FOR EACH ROW
EXECUTE FUNCTION public.fire_payment_receipt_email();

-- WalletCharged → Wallet notice
CREATE TRIGGER trg_fire_wallet_balance_email
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.fire_wallet_balance_email();

-- CreditNote issued → Refund email
CREATE TRIGGER trg_fire_credit_note_email
AFTER UPDATE ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION public.fire_credit_note_email();

-- UserCreated → Activation email
CREATE TRIGGER trg_fire_activation_email
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fire_activation_email();

-- SubscriptionPurchased → Confirmation
CREATE TRIGGER trg_fire_subscription_email
AFTER UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.fire_subscription_email();

-- IntegrationActivated → Success notice
CREATE TRIGGER trg_fire_integration_email
AFTER UPDATE ON public.tenant_integrations
FOR EACH ROW
EXECUTE FUNCTION public.fire_integration_email();

-- SecurityEvent (account lock) → Alert
CREATE TRIGGER trg_fire_security_alert_email
AFTER INSERT ON public.account_locks
FOR EACH ROW
EXECUTE FUNCTION public.fire_security_alert_email();
