
-- ============================================================
-- 1. UPGRADE assert_tenant_member with optional roles parameter
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_tenant_member(
  p_tenant_id uuid,
  p_roles text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- service_role always bypasses
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;

  -- Check membership (and optionally role)
  IF p_roles IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_id = p_tenant_id
        AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Access denied: not a tenant member';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_id = p_tenant_id
        AND user_id = auth.uid()
        AND role::text = ANY(p_roles)
    ) THEN
      RAISE EXCEPTION 'Access denied: insufficient role';
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- 2. ADD assert_tenant_member to check_subscription_integrity
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_subscription_integrity(_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sub RECORD;
  _plan_slug text;
  _fixes jsonb := '[]'::jsonb;
  _orphan RECORD;
  _ent RECORD;
  _flag RECORD;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);

  SELECT s.*, sp.slug AS plan_slug, sp.id AS sp_id
  INTO _sub
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial','past_due')
  ORDER BY s.created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_subscription', 'fixes', _fixes);
  END IF;

  _plan_slug := _sub.plan_slug;

  FOR _orphan IN
    SELECT tpi.id, tpi.integration_id, pi.key, pi.name_ar, tpi.activation_source, pi.included_in_plans
    FROM public.tenant_paid_integrations tpi
    JOIN public.paid_integrations pi ON pi.id = tpi.integration_id
    WHERE tpi.tenant_id = _tenant_id
      AND tpi.status = 'active'
      AND tpi.activation_source IN ('trial_auto', 'enterprise_auto')
      AND NOT (_plan_slug = ANY(pi.included_in_plans))
      AND _sub.status != 'trial'
  LOOP
    UPDATE public.tenant_paid_integrations
    SET status = 'disabled',
        deactivated_at = now(),
        deactivation_reason = 'integrity_check_orphan'
    WHERE id = _orphan.id;

    _fixes := _fixes || jsonb_build_object(
      'type', 'orphan_integration_disabled',
      'integration_key', _orphan.key,
      'name', _orphan.name_ar,
      'source', _orphan.activation_source,
      'plan', _plan_slug
    );
  END LOOP;

  FOR _flag IN
    SELECT ff.key, ff.name_ar
    FROM public.feature_flags ff
    WHERE ff.is_enabled_globally = true
      AND NOT (_plan_slug = ANY(ff.enabled_plans))
      AND _sub.status != 'trial'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = _sub.sp_id
        AND pe.feature_key = _flag.key
        AND pe.is_enabled = true
    ) THEN
      _fixes := _fixes || jsonb_build_object(
        'type', 'entitlement_plan_mismatch',
        'feature_key', _flag.key,
        'name', _flag.name_ar,
        'plan', _plan_slug,
        'action', 'logged_for_review'
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(_fixes) > 0 THEN
    INSERT INTO public.audit_logs (
      tenant_id, user_id, action, entity_type, entity_id, entity_label, changes
    ) VALUES (
      _tenant_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'integrity_auto_correct',
      'subscription',
      _sub.id,
      _plan_slug,
      jsonb_build_object('fixes', _fixes, 'checked_at', now())
    );

    INSERT INTO public.collaboration_notifications (
      tenant_id, user_id, actor_id, type, message, entity_type, entity_id
    )
    SELECT
      _tenant_id,
      pa.user_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'integrity_alert',
      'تم اكتشاف وإصلاح ' || jsonb_array_length(_fixes) || ' مخالفة في اشتراك المنشأة تلقائياً',
      'subscription',
      _sub.id
    FROM public.platform_admins pa;
  END IF;

  RETURN jsonb_build_object(
    'status', 'checked',
    'plan', _plan_slug,
    'subscription_status', _sub.status,
    'fixes_count', jsonb_array_length(_fixes),
    'fixes', _fixes
  );
END;
$function$;

-- ============================================================
-- 3. ADD assert_tenant_member to reconcile_invoices_vs_payments
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_invoices_vs_payments(p_tenant_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_run_id uuid := gen_random_uuid(); v_rec RECORD; v_total int := 0; v_issues int := 0;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  FOR v_rec IN
    SELECT i.id AS invoice_id, i.invoice_number, i.grand_total,
           COALESCE(SUM(ip.amount), 0) AS paid_total,
           i.amount_due, i.status
    FROM invoices i LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id AND ip.tenant_id = p_tenant_id
    WHERE i.tenant_id = p_tenant_id AND i.deleted_at IS NULL
      AND (p_date_from IS NULL OR i.invoice_date >= p_date_from)
      AND (p_date_to IS NULL OR i.invoice_date <= p_date_to)
    GROUP BY i.id
  LOOP
    v_total := v_total + 1;
    IF ABS(v_rec.grand_total - v_rec.paid_total - v_rec.amount_due) > 0.01 THEN
      v_issues := v_issues + 1;
      INSERT INTO reconciliation_results (tenant_id, run_id, check_type, entity_type, entity_id, entity_label, status, details)
      VALUES (p_tenant_id, v_run_id, 'invoice_payment_mismatch', 'invoice', v_rec.invoice_id, v_rec.invoice_number, 'mismatch',
        jsonb_build_object('grand_total', v_rec.grand_total, 'paid_total', v_rec.paid_total, 'amount_due', v_rec.amount_due,
          'expected_due', v_rec.grand_total - v_rec.paid_total, 'difference', ABS(v_rec.grand_total - v_rec.paid_total - v_rec.amount_due)));
    END IF;
  END LOOP;

  INSERT INTO reconciliation_results (tenant_id, run_id, check_type, entity_type, entity_id, entity_label, status, details)
  VALUES (p_tenant_id, v_run_id, 'invoice_payment_mismatch', 'summary', NULL, 'ملخص', 'summary',
    jsonb_build_object('total_checked', v_total, 'issues_found', v_issues, 'run_at', now()));
  RETURN v_run_id;
END;
$function$;

-- ============================================================
-- 4. ADD assert_tenant_member to reconcile_subscription_revenue
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_subscription_revenue(p_tenant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_run_id uuid := gen_random_uuid(); v_rec RECORD; v_total int := 0; v_issues int := 0;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  FOR v_rec IN
    SELECT s.id AS sub_id, sp.name_ar AS plan_name, sp.price_monthly,
           COALESCE((SELECT SUM(ip.amount) FROM invoice_payments ip
            JOIN invoices inv ON inv.id = ip.invoice_id
            WHERE inv.tenant_id = p_tenant_id AND inv.source_type = 'subscription'), 0) AS total_paid,
           s.status, s.current_period_start, s.current_period_end
    FROM subscriptions s JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.tenant_id = p_tenant_id AND s.status IN ('active','trial','past_due')
    ORDER BY s.created_at DESC LIMIT 1
  LOOP
    v_total := v_total + 1;
    IF v_rec.status = 'active' AND v_rec.total_paid = 0 THEN
      v_issues := v_issues + 1;
      INSERT INTO reconciliation_results (tenant_id, run_id, check_type, entity_type, entity_id, entity_label, status, details)
      VALUES (p_tenant_id, v_run_id, 'subscription_revenue', 'subscription', v_rec.sub_id, v_rec.plan_name, 'mismatch',
        jsonb_build_object('plan_price', v_rec.price_monthly, 'total_paid', v_rec.total_paid, 'status', v_rec.status));
    END IF;
  END LOOP;

  INSERT INTO reconciliation_results (tenant_id, run_id, check_type, entity_type, entity_id, entity_label, status, details)
  VALUES (p_tenant_id, v_run_id, 'subscription_revenue', 'summary', NULL, 'ملخص', 'summary',
    jsonb_build_object('total_checked', v_total, 'issues_found', v_issues, 'run_at', now()));
  RETURN v_run_id;
END;
$function$;

-- ============================================================
-- 5. ADD assert_tenant_member to reconcile_vat_totals
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_vat_totals(p_tenant_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_run_id uuid := gen_random_uuid(); v_rec RECORD; v_total int := 0; v_issues int := 0;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  FOR v_rec IN
    SELECT i.id AS invoice_id, i.invoice_number, i.vat_total AS header_vat,
           COALESCE(SUM(ii.vat_amount), 0) AS items_vat
    FROM invoices i LEFT JOIN invoice_items ii ON ii.invoice_id = i.id AND ii.tenant_id = p_tenant_id
    WHERE i.tenant_id = p_tenant_id AND i.deleted_at IS NULL
      AND (p_date_from IS NULL OR i.invoice_date >= p_date_from)
      AND (p_date_to IS NULL OR i.invoice_date <= p_date_to)
    GROUP BY i.id
  LOOP
    v_total := v_total + 1;
    IF ABS(v_rec.header_vat - v_rec.items_vat) > 0.01 THEN
      v_issues := v_issues + 1;
      INSERT INTO reconciliation_results (tenant_id, run_id, check_type, entity_type, entity_id, entity_label, status, details)
      VALUES (p_tenant_id, v_run_id, 'vat_mismatch', 'invoice', v_rec.invoice_id, v_rec.invoice_number, 'mismatch',
        jsonb_build_object('header_vat', v_rec.header_vat, 'items_vat', v_rec.items_vat, 'difference', ABS(v_rec.header_vat - v_rec.items_vat)));
    END IF;
  END LOOP;

  INSERT INTO reconciliation_results (tenant_id, run_id, check_type, entity_type, entity_id, entity_label, status, details)
  VALUES (p_tenant_id, v_run_id, 'vat_mismatch', 'summary', NULL, 'ملخص', 'summary',
    jsonb_build_object('total_checked', v_total, 'issues_found', v_issues, 'run_at', now()));
  RETURN v_run_id;
END;
$function$;

-- ============================================================
-- 6. ADD assert_tenant_member to reconcile_wallet_vs_journal
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_wallet_vs_journal(p_tenant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_run_id uuid := gen_random_uuid(); v_rec RECORD; v_total int := 0; v_issues int := 0;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  FOR v_rec IN
    SELECT tw.id AS wallet_id, tw.balance AS wallet_balance,
           COALESCE(SUM(CASE WHEN wt.type IN ('credit','topup','refund') THEN wt.amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN wt.type IN ('debit','fee','payout') THEN wt.amount ELSE 0 END), 0) AS calc_balance
    FROM tenant_wallets tw LEFT JOIN wallet_transactions wt ON wt.wallet_id = tw.id AND wt.status = 'completed'
    WHERE tw.tenant_id = p_tenant_id
    GROUP BY tw.id
  LOOP
    v_total := v_total + 1;
    IF ABS(v_rec.wallet_balance - v_rec.calc_balance) > 0.01 THEN
      v_issues := v_issues + 1;
      INSERT INTO reconciliation_results (tenant_id, run_id, check_type, entity_type, entity_id, entity_label, status, details)
      VALUES (p_tenant_id, v_run_id, 'wallet_balance', 'wallet', v_rec.wallet_id, 'المحفظة', 'mismatch',
        jsonb_build_object('recorded_balance', v_rec.wallet_balance, 'calculated_balance', v_rec.calc_balance,
          'difference', ABS(v_rec.wallet_balance - v_rec.calc_balance)));
    END IF;
  END LOOP;

  INSERT INTO reconciliation_results (tenant_id, run_id, check_type, entity_type, entity_id, entity_label, status, details)
  VALUES (p_tenant_id, v_run_id, 'wallet_balance', 'summary', NULL, 'ملخص', 'summary',
    jsonb_build_object('total_checked', v_total, 'issues_found', v_issues, 'run_at', now()));
  RETURN v_run_id;
END;
$function$;
