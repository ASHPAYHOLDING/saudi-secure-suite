
CREATE OR REPLACE FUNCTION public.generate_smart_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant RECORD;
  _invoice RECORD;
  _product RECORD;
  _sub RECORD;
  _is_enabled boolean;
  _days_before integer;
  _exists boolean;
BEGIN
  FOR _tenant IN SELECT id FROM public.tenants WHERE status = 'active' LOOP

    -- 1. Invoice due reminders
    SELECT np.is_enabled, np.days_before INTO _is_enabled, _days_before
    FROM public.notification_preferences np
    WHERE np.tenant_id = _tenant.id AND np.notification_type = 'invoice_due';
    
    _is_enabled := COALESCE(_is_enabled, true);
    _days_before := COALESCE(_days_before, 3);

    IF _is_enabled THEN
      FOR _invoice IN
        SELECT i.id, i.invoice_number, i.due_date, i.grand_total
        FROM public.invoices i
        WHERE i.tenant_id = _tenant.id AND i.status IN ('issued', 'sent')
          AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (_days_before || ' days')::interval
      LOOP
        SELECT EXISTS(SELECT 1 FROM public.tenant_notifications tn WHERE tn.tenant_id = _tenant.id AND tn.type = 'invoice_due' AND tn.entity_id = _invoice.id AND tn.created_at > now() - interval '1 day') INTO _exists;
        IF NOT _exists THEN
          INSERT INTO public.tenant_notifications (tenant_id, type, title, message, severity, entity_type, entity_id)
          VALUES (_tenant.id, 'invoice_due', 'فاتورة مستحقة قريباً',
            'الفاتورة ' || _invoice.invoice_number || ' مستحقة بتاريخ ' || _invoice.due_date || ' بمبلغ ' || _invoice.grand_total || ' ر.س',
            'warning', 'invoice', _invoice.id);
        END IF;
      END LOOP;
    END IF;

    -- 2. Overdue invoices
    FOR _invoice IN
      SELECT i.id, i.invoice_number, i.due_date, i.amount_due
      FROM public.invoices i
      WHERE i.tenant_id = _tenant.id AND i.status IN ('issued', 'sent') AND i.due_date < CURRENT_DATE AND i.amount_due > 0
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.tenant_notifications tn WHERE tn.tenant_id = _tenant.id AND tn.type = 'invoice_overdue' AND tn.entity_id = _invoice.id AND tn.created_at > now() - interval '1 day') INTO _exists;
      IF NOT _exists THEN
        INSERT INTO public.tenant_notifications (tenant_id, type, title, message, severity, entity_type, entity_id)
        VALUES (_tenant.id, 'invoice_overdue', 'فاتورة متأخرة',
          'الفاتورة ' || _invoice.invoice_number || ' متأخرة منذ ' || _invoice.due_date || ' - المبلغ المستحق: ' || _invoice.amount_due || ' ر.س',
          'critical', 'invoice', _invoice.id);
      END IF;
    END LOOP;

    -- 3. Low stock
    FOR _product IN
      SELECT p.id, p.name, p.stock_quantity, p.low_stock_threshold
      FROM public.products p
      WHERE p.tenant_id = _tenant.id AND p.is_active AND p.track_stock AND p.stock_quantity <= COALESCE(p.low_stock_threshold, 0)
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.tenant_notifications tn WHERE tn.tenant_id = _tenant.id AND tn.type = 'low_stock' AND tn.entity_id = _product.id AND tn.created_at > now() - interval '1 day') INTO _exists;
      IF NOT _exists THEN
        INSERT INTO public.tenant_notifications (tenant_id, type, title, message, severity, entity_type, entity_id)
        VALUES (_tenant.id, 'low_stock',
          CASE WHEN _product.stock_quantity = 0 THEN 'نفد المخزون' ELSE 'مخزون منخفض' END,
          'المنتج "' || _product.name || '" - الكمية: ' || _product.stock_quantity,
          CASE WHEN _product.stock_quantity = 0 THEN 'critical' ELSE 'warning' END,
          'product', _product.id);
      END IF;
    END LOOP;

    -- 4. Subscription expiry
    FOR _sub IN
      SELECT s.id, s.current_period_end, sp.name_ar
      FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.tenant_id = _tenant.id AND s.status IN ('active', 'trial') AND s.current_period_end BETWEEN now() AND now() + interval '7 days'
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.tenant_notifications tn WHERE tn.tenant_id = _tenant.id AND tn.type = 'subscription_expiry' AND tn.entity_id = _sub.id AND tn.created_at > now() - interval '1 day') INTO _exists;
      IF NOT _exists THEN
        INSERT INTO public.tenant_notifications (tenant_id, type, title, message, severity, entity_type, entity_id)
        VALUES (_tenant.id, 'subscription_expiry', 'اشتراكك ينتهي قريباً',
          'خطة "' || _sub.name_ar || '" تنتهي بتاريخ ' || _sub.current_period_end::date,
          'warning', 'subscription', _sub.id);
      END IF;
    END LOOP;

    -- 5. Compliance: VAT registered but no VAT number
    IF EXISTS(SELECT 1 FROM public.tenants t WHERE t.id = _tenant.id AND t.vat_registered AND (t.vat_number IS NULL OR t.vat_number = '')) THEN
      SELECT EXISTS(SELECT 1 FROM public.tenant_notifications tn WHERE tn.tenant_id = _tenant.id AND tn.type = 'compliance_warning' AND tn.title = 'رقم ضريبي مطلوب' AND tn.created_at > now() - interval '7 days') INTO _exists;
      IF NOT _exists THEN
        INSERT INTO public.tenant_notifications (tenant_id, type, title, message, severity, entity_type, entity_id)
        VALUES (_tenant.id, 'compliance_warning', 'رقم ضريبي مطلوب', 'منشأتك مسجلة في ضريبة القيمة المضافة لكن لم يتم إدخال الرقم الضريبي.', 'critical', 'tenant', _tenant.id);
      END IF;
    END IF;

    -- ZATCA enabled but no CR
    IF EXISTS(SELECT 1 FROM public.tenants t WHERE t.id = _tenant.id AND t.zatca_phase1_enabled AND (t.cr_number IS NULL OR t.cr_number = '')) THEN
      SELECT EXISTS(SELECT 1 FROM public.tenant_notifications tn WHERE tn.tenant_id = _tenant.id AND tn.type = 'compliance_warning' AND tn.title = 'سجل تجاري مطلوب' AND tn.created_at > now() - interval '7 days') INTO _exists;
      IF NOT _exists THEN
        INSERT INTO public.tenant_notifications (tenant_id, type, title, message, severity, entity_type, entity_id)
        VALUES (_tenant.id, 'compliance_warning', 'سجل تجاري مطلوب', 'تم تفعيل ZATCA لكن لم يتم إدخال رقم السجل التجاري.', 'critical', 'tenant', _tenant.id);
      END IF;
    END IF;

  END LOOP;
END;
$$;
