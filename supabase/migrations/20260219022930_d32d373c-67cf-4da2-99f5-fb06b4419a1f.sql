
-- Step 1: Update assert_tenant_member to allow service_role bypass
CREATE OR REPLACE FUNCTION public.assert_tenant_member(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (edge functions / cron) through
  IF (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
  ) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: user % is not a member of tenant %', auth.uid(), _tenant_id;
  END IF;
END;
$$;

-- Step 2: Inject guard into all unprotected write functions

-- 2a: apply_subscription_discount
CREATE OR REPLACE FUNCTION public.apply_subscription_discount(_code text, _tenant_id uuid, _plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _discount RECORD; _plan RECORD; _sub RECORD;
  _already_used BOOLEAN; _original_price NUMERIC; _new_price NUMERIC; _discount_amount NUMERIC;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);

  SELECT * INTO _discount FROM public.subscription_discounts WHERE code = UPPER(TRIM(_code)) FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', NULL, UPPER(TRIM(_code)),
      jsonb_build_object('reason', 'code_not_found', 'code', UPPER(TRIM(_code))));
    RETURN jsonb_build_object('success', false, 'error', 'الكود غير موجود');
  END IF;
  IF NOT _discount.is_active THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'code_inactive'));
    RETURN jsonb_build_object('success', false, 'error', 'الكود معطل');
  END IF;
  IF now() < _discount.starts_at OR now() > _discount.expires_at THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'code_expired'));
    RETURN jsonb_build_object('success', false, 'error', 'الكود منتهي الصلاحية');
  END IF;
  IF _discount.max_uses IS NOT NULL AND _discount.used_count >= _discount.max_uses THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'max_uses_reached', 'max_uses', _discount.max_uses));
    RETURN jsonb_build_object('success', false, 'error', 'تم استنفاد عدد الاستخدامات المسموح');
  END IF;
  IF _discount.eligible_plan_ids IS NOT NULL AND NOT (_plan_id = ANY(_discount.eligible_plan_ids)) THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'plan_not_eligible', 'plan_id', _plan_id::text));
    RETURN jsonb_build_object('success', false, 'error', 'الكود غير صالح لهذه الخطة');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.subscription_discount_usage WHERE discount_id = _discount.id AND tenant_id = _tenant_id) INTO _already_used;
  IF _already_used THEN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (_tenant_id, auth.uid(), 'discount_failed', 'subscription_discount', _discount.id, _discount.code,
      jsonb_build_object('reason', 'already_used_by_tenant'));
    RETURN jsonb_build_object('success', false, 'error', 'تم استخدام هذا الكود مسبقاً');
  END IF;
  SELECT * INTO _plan FROM public.subscription_plans WHERE id = _plan_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'الخطة غير موجودة'); END IF;
  _original_price := _plan.price_monthly;
  IF _discount.discount_type = 'percentage' THEN
    _discount_amount := ROUND(_original_price * _discount.discount_value / 100, 2);
  ELSE
    _discount_amount := LEAST(_discount.discount_value, _original_price);
  END IF;
  _new_price := GREATEST(_original_price - _discount_amount, 0);
  SELECT * INTO _sub FROM public.subscriptions WHERE tenant_id = _tenant_id AND status IN ('active', 'trial', 'past_due') ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'لا يوجد اشتراك فعال'); END IF;
  INSERT INTO public.subscription_discount_usage (discount_id, tenant_id, subscription_id, amount_before, amount_after)
  VALUES (_discount.id, _tenant_id, _sub.id, _original_price, _new_price);
  UPDATE public.subscription_discounts SET used_count = used_count + 1 WHERE id = _discount.id;
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (_tenant_id, auth.uid(), 'discount_applied', 'subscription_discount', _discount.id, _discount.code,
    jsonb_build_object('plan_id', _plan_id::text, 'amount_before', _original_price, 'amount_after', _new_price,
      'discount_value', _discount.discount_value, 'discount_type', _discount.discount_type));
  RETURN jsonb_build_object('success', true, 'discount_id', _discount.id, 'code', _discount.code,
    'discount_type', _discount.discount_type, 'discount_value', _discount.discount_value,
    'amount_before', _original_price, 'amount_after', _new_price, 'discount_amount', _discount_amount);
END;
$function$;

-- 2b: auto_activate_enterprise_integrations
CREATE OR REPLACE FUNCTION public.auto_activate_enterprise_integrations(_tenant_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _integration RECORD;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.tenant_id = _tenant_id AND s.status IN ('active', 'trial') AND sp.slug = 'enterprise'
  ) THEN RETURN; END IF;
  FOR _integration IN
    SELECT id, key, requires_api_keys FROM public.paid_integrations WHERE is_ready = true AND is_listed = true
  LOOP
    INSERT INTO public.tenant_paid_integrations (tenant_id, integration_id, status, activated_by, purchased_at, activated_at, activation_source)
    VALUES (_tenant_id, _integration.id, CASE WHEN _integration.requires_api_keys THEN 'disabled' ELSE 'active' END, _user_id, now(), now(), 'enterprise_auto')
    ON CONFLICT (tenant_id, integration_id) DO NOTHING;
  END LOOP;
END;
$function$;

-- 2c: budget_incremental_update
CREATE OR REPLACE FUNCTION public.budget_incremental_update(p_tenant_id uuid, p_year integer, p_month integer, p_line_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_budget record; v_line record; v_period text; v_actual numeric;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);
  v_period := p_year::text || '-' || LPAD(p_month::text, 2, '0');
  FOR v_budget IN SELECT id FROM budgets WHERE tenant_id = p_tenant_id AND fiscal_year = p_year AND status IN ('active', 'draft')
  LOOP
    FOR v_line IN SELECT id FROM budget_lines WHERE budget_id = v_budget.id AND tenant_id = p_tenant_id AND line_type = p_line_type::budget_line_type
    LOOP
      v_actual := 0;
      IF p_line_type = 'expense' THEN
        SELECT COALESCE(SUM(total_amount), 0) INTO v_actual FROM expenses WHERE tenant_id = p_tenant_id AND status = 'approved' AND EXTRACT(YEAR FROM expense_date) = p_year AND EXTRACT(MONTH FROM expense_date) = p_month;
      ELSIF p_line_type = 'revenue' THEN
        SELECT COALESCE(SUM(ip.amount), 0) INTO v_actual FROM invoice_payments ip WHERE ip.tenant_id = p_tenant_id AND EXTRACT(YEAR FROM ip.payment_date) = p_year AND EXTRACT(MONTH FROM ip.payment_date) = p_month;
      ELSIF p_line_type = 'capex' THEN
        SELECT COALESCE(SUM(jel.debit), 0) INTO v_actual FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE je.tenant_id = p_tenant_id AND je.status = 'posted' AND EXTRACT(YEAR FROM je.entry_date) = p_year AND EXTRACT(MONTH FROM je.entry_date) = p_month;
      END IF;
      INSERT INTO budget_actuals_cache (tenant_id, budget_id, line_id, period, actual_amount, updated_at)
      VALUES (p_tenant_id, v_budget.id, v_line.id, v_period, v_actual, now())
      ON CONFLICT (tenant_id, line_id, period) DO UPDATE SET actual_amount = EXCLUDED.actual_amount, updated_at = now();
    END LOOP;
  END LOOP;
END;
$function$;

-- 2d: create_document_access_token
CREATE OR REPLACE FUNCTION public.create_document_access_token(_tenant_id uuid, _document_type text, _document_id uuid, _hours integer DEFAULT 48, _max_access integer DEFAULT 5)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _token TEXT;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  _token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.document_access_tokens (tenant_id, document_type, document_id, token, expires_at, max_access, created_by)
  VALUES (_tenant_id, _document_type, _document_id, _token, now() + (_hours || ' hours')::interval, _max_access, auth.uid());
  RETURN _token;
END;
$function$;

-- 2e: generate_inventory_number
CREATE OR REPLACE FUNCTION public.generate_inventory_number(p_tenant_id uuid, p_prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count INT; v_number TEXT;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);
  SELECT COUNT(*) + 1 INTO v_count FROM (
    SELECT 1 FROM goods_receipts WHERE tenant_id = p_tenant_id
    UNION ALL SELECT 1 FROM warehouse_transfers WHERE tenant_id = p_tenant_id
    UNION ALL SELECT 1 FROM stocktakes WHERE tenant_id = p_tenant_id
  ) sub;
  v_number := p_prefix || '-' || LPAD(v_count::TEXT, 5, '0');
  RETURN v_number;
END;
$function$;

-- 2f: get_metric_breakdown (also fix tenant_users → tenant_members bug)
CREATE OR REPLACE FUNCTION public.get_metric_breakdown(p_metric_key text, p_tenant_id uuid, p_date_from date, p_date_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result JSONB;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  CASE p_metric_key
  WHEN 'revenue' THEN
    SELECT jsonb_build_object('metric','revenue','value',COALESCE(SUM(jel.credit-jel.debit),0),
      'source','journal_entries → revenue accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('account',jel.account_name,'period',date_trunc('month',je.entry_date)::date,'amount',jel.credit-jel.debit)),'[]'::jsonb))
    INTO result FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    WHERE je.tenant_id=p_tenant_id AND je.status='posted' AND je.entry_date BETWEEN p_date_from AND p_date_to AND classify_account(jel.account_name)='revenue';
  WHEN 'expenses' THEN
    SELECT jsonb_build_object('metric','expenses','value',COALESCE(SUM(jel.debit-jel.credit),0),
      'source','journal_entries → expense/cogs accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('account',jel.account_name,'source_type',je.source_type,'period',date_trunc('month',je.entry_date)::date,'amount',jel.debit-jel.credit)),'[]'::jsonb))
    INTO result FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    WHERE je.tenant_id=p_tenant_id AND je.status='posted' AND je.entry_date BETWEEN p_date_from AND p_date_to AND classify_account(jel.account_name) IN ('expense','cogs');
  WHEN 'net_profit' THEN
    SELECT jsonb_build_object('metric','net_profit',
      'value',COALESCE(SUM(CASE WHEN classify_account(jel.account_name)='revenue' THEN jel.credit-jel.debit WHEN classify_account(jel.account_name) IN ('expense','cogs') THEN -(jel.debit-jel.credit) ELSE 0 END),0),
      'source','journal_entries → revenue - expenses',
      'drilldown',jsonb_build_object(
        'revenue',(SELECT COALESCE(SUM(l.credit-l.debit),0) FROM journal_entries e JOIN journal_entry_lines l ON l.journal_entry_id=e.id WHERE e.tenant_id=p_tenant_id AND e.status='posted' AND e.entry_date BETWEEN p_date_from AND p_date_to AND classify_account(l.account_name)='revenue'),
        'expenses',(SELECT COALESCE(SUM(l.debit-l.credit),0) FROM journal_entries e JOIN journal_entry_lines l ON l.journal_entry_id=e.id WHERE e.tenant_id=p_tenant_id AND e.status='posted' AND e.entry_date BETWEEN p_date_from AND p_date_to AND classify_account(l.account_name) IN ('expense','cogs'))))
    INTO result FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    WHERE je.tenant_id=p_tenant_id AND je.status='posted' AND je.entry_date BETWEEN p_date_from AND p_date_to;
  WHEN 'vat_payable' THEN
    SELECT jsonb_build_object('metric','vat_payable','value',COALESCE(SUM(jel.credit-jel.debit),0),
      'source','journal_entries → vat/tax accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('account',jel.account_name,'source_type',je.source_type,'period',date_trunc('month',je.entry_date)::date,'vat_output',jel.credit,'vat_input',jel.debit,'net',jel.credit-jel.debit)),'[]'::jsonb))
    INTO result FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    WHERE je.tenant_id=p_tenant_id AND je.status='posted' AND je.entry_date BETWEEN p_date_from AND p_date_to
      AND (jel.account_name ILIKE '%ضريبة%' OR jel.account_name ILIKE '%vat%' OR jel.account_name ILIKE '%tax%');
  WHEN 'cashflow' THEN
    SELECT jsonb_build_object('metric','cashflow','value',COALESCE(SUM(jel.debit-jel.credit),0),
      'source','journal_entries → cash/bank accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('source_type',je.source_type,'period',date_trunc('month',je.entry_date)::date,'cash_in',jel.debit,'cash_out',jel.credit)),'[]'::jsonb))
    INTO result FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    WHERE je.tenant_id=p_tenant_id AND je.status='posted' AND je.entry_date BETWEEN p_date_from AND p_date_to
      AND (jel.account_name ILIKE '%نقد%' OR jel.account_name ILIKE '%cash%' OR jel.account_name ILIKE '%بنك%' OR jel.account_name ILIKE '%bank%');
  WHEN 'ar_aging' THEN
    SELECT jsonb_build_object('metric','ar_aging','value',COALESCE(SUM(i.amount_due),0),
      'source','invoices + journal_entries → receivable accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('invoice_number',i.invoice_number,'customer_id',i.customer_id,'amount_due',i.amount_due,'due_date',i.due_date,'days_overdue',CURRENT_DATE-i.due_date,
        'bucket',CASE WHEN CURRENT_DATE-i.due_date<=0 THEN 'current' WHEN CURRENT_DATE-i.due_date<=30 THEN '1-30' WHEN CURRENT_DATE-i.due_date<=60 THEN '31-60' WHEN CURRENT_DATE-i.due_date<=90 THEN '61-90' ELSE '90+' END)),'[]'::jsonb))
    INTO result FROM invoices i WHERE i.tenant_id=p_tenant_id AND i.status NOT IN ('draft','cancelled','void') AND i.amount_due>0 AND i.invoice_date BETWEEN p_date_from AND p_date_to;
  WHEN 'ap_aging' THEN
    SELECT jsonb_build_object('metric','ap_aging','value',COALESCE(SUM(po.grand_total),0),
      'source','purchase_orders + journal_entries → payable accounts',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('order_number',po.order_number,'supplier_id',po.supplier_id,'amount',po.grand_total,'due_date',po.expected_delivery_date,'days_overdue',CURRENT_DATE-po.expected_delivery_date,
        'bucket',CASE WHEN CURRENT_DATE-po.expected_delivery_date<=0 THEN 'current' WHEN CURRENT_DATE-po.expected_delivery_date<=30 THEN '1-30' WHEN CURRENT_DATE-po.expected_delivery_date<=60 THEN '31-60' WHEN CURRENT_DATE-po.expected_delivery_date<=90 THEN '61-90' ELSE '90+' END)),'[]'::jsonb))
    INTO result FROM purchase_orders po WHERE po.tenant_id=p_tenant_id AND po.status NOT IN ('draft','cancelled','rejected') AND po.order_date BETWEEN p_date_from AND p_date_to;
  WHEN 'wallet_activity' THEN
    SELECT jsonb_build_object('metric','wallet_activity','value',COALESCE(SUM(wt.amount),0),
      'source','wallet_transactions',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('type',wt.type,'source',wt.source,'amount',wt.amount,'date',wt.created_at)),'[]'::jsonb))
    INTO result FROM wallet_transactions wt JOIN tenant_wallets tw ON tw.id=wt.wallet_id
    WHERE tw.tenant_id=p_tenant_id AND wt.created_at>=p_date_from AND wt.created_at<p_date_to+1;
  WHEN 'subscription_revenue' THEN
    SELECT jsonb_build_object('metric','subscription_revenue',
      'value',COALESCE(SUM(CASE s.billing_cycle WHEN 'monthly' THEN sp.price_monthly WHEN 'yearly' THEN sp.price_yearly ELSE 0 END),0),
      'source','subscriptions + subscription_plans',
      'drilldown',COALESCE(jsonb_agg(jsonb_build_object('plan',sp.name_ar,'cycle',s.billing_cycle,'status',s.status,
        'amount',CASE s.billing_cycle WHEN 'monthly' THEN sp.price_monthly WHEN 'yearly' THEN sp.price_yearly ELSE 0 END,
        'period_start',s.current_period_start,'period_end',s.current_period_end)),'[]'::jsonb))
    INTO result FROM subscriptions s JOIN subscription_plans sp ON sp.id=s.plan_id
    WHERE s.tenant_id=p_tenant_id AND s.status='active';
  ELSE
    result := jsonb_build_object('error','Unknown metric_key: '||p_metric_key,'available_keys',ARRAY['revenue','expenses','net_profit','vat_payable','cashflow','ar_aging','ap_aging','wallet_activity','subscription_revenue']);
  END CASE;
  RETURN result;
END;
$function$;

-- 2g: get_next_icv
CREATE OR REPLACE FUNCTION public.get_next_icv(_tenant_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _next_icv BIGINT;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  INSERT INTO zatca_icv_counter (tenant_id, last_icv, updated_at)
  VALUES (_tenant_id, 1, now())
  ON CONFLICT (tenant_id) DO UPDATE SET last_icv = zatca_icv_counter.last_icv + 1, updated_at = now()
  RETURNING last_icv INTO _next_icv;
  RETURN _next_icv;
END;
$function$;

-- 2h: get_tenant_usage_summary
CREATE OR REPLACE FUNCTION public.get_tenant_usage_summary(_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _sub RECORD; _user_count integer; _invoice_count integer; _storage_bytes bigint; _storage_gb numeric; _result jsonb;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  SELECT s.*, sp.max_users, sp.max_invoices, sp.max_storage_gb, sp.slug AS plan_slug, s.status AS sub_status
  INTO _sub FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial','past_due') ORDER BY s.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'no_subscription'); END IF;
  SELECT count(*) INTO _user_count FROM public.tenant_members WHERE tenant_id = _tenant_id;
  SELECT count(*) INTO _invoice_count FROM public.invoices
  WHERE tenant_id = _tenant_id AND created_at >= date_trunc('month', now()) AND created_at < date_trunc('month', now()) + interval '1 month';
  SELECT COALESCE(sum(o.metadata->>'size')::bigint, 0) INTO _storage_bytes FROM storage.objects o WHERE o.name LIKE _tenant_id::text || '/%';
  _storage_gb := ROUND(_storage_bytes / (1024.0 * 1024 * 1024), 2);
  _result := jsonb_build_object(
    'is_trial', _sub.sub_status = 'trial', 'plan_slug', _sub.plan_slug,
    'users', jsonb_build_object('current', _user_count, 'limit', _sub.max_users, 'unlimited', _sub.max_users IS NULL),
    'invoices_monthly', jsonb_build_object('current', _invoice_count, 'limit', _sub.max_invoices, 'unlimited', _sub.max_invoices IS NULL),
    'storage_gb', jsonb_build_object('current', _storage_gb, 'limit', _sub.max_storage_gb, 'unlimited', _sub.max_storage_gb IS NULL));
  RETURN _result;
END;
$function$;

-- 2i: process_inventory_movement
CREATE OR REPLACE FUNCTION public.process_inventory_movement(p_tenant_id uuid, p_warehouse_id uuid, p_product_id uuid, p_variant_id uuid, p_movement_type text, p_quantity numeric, p_unit_cost numeric, p_reference_type text, p_reference_id uuid, p_transfer_id uuid, p_notes text, p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_balance RECORD; v_prev_qty NUMERIC; v_prev_cost NUMERIC; v_new_qty NUMERIC; v_new_cost NUMERIC; v_total_cost NUMERIC; v_movement_id UUID;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);
  SELECT * INTO v_balance FROM inventory_balances WHERE tenant_id = p_tenant_id AND warehouse_id = p_warehouse_id AND product_id = p_product_id AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL)) FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO inventory_balances (tenant_id, warehouse_id, product_id, variant_id, quantity_on_hand, weighted_avg_cost)
    VALUES (p_tenant_id, p_warehouse_id, p_product_id, p_variant_id, 0, 0) RETURNING * INTO v_balance;
  END IF;
  v_prev_qty := v_balance.quantity_on_hand; v_prev_cost := v_balance.weighted_avg_cost;
  IF p_movement_type IN ('goods_receipt', 'transfer_in', 'return_in') THEN
    v_new_qty := v_prev_qty + p_quantity;
    IF v_new_qty > 0 THEN v_new_cost := ((v_prev_qty * v_prev_cost) + (p_quantity * p_unit_cost)) / v_new_qty;
    ELSE v_new_cost := p_unit_cost; END IF;
  ELSIF p_movement_type IN ('goods_issue', 'transfer_out', 'return_out', 'cogs') THEN
    v_new_qty := v_prev_qty - p_quantity; v_new_cost := v_prev_cost;
  ELSIF p_movement_type IN ('adjustment', 'stocktake') THEN
    v_new_qty := v_prev_qty + p_quantity; v_new_cost := CASE WHEN p_unit_cost > 0 THEN p_unit_cost ELSE v_prev_cost END;
  ELSE RAISE EXCEPTION 'Unknown movement type: %', p_movement_type; END IF;
  v_total_cost := ABS(p_quantity) * COALESCE(CASE WHEN p_movement_type IN ('goods_issue','transfer_out','return_out','cogs') THEN v_prev_cost ELSE p_unit_cost END, 0);
  INSERT INTO inventory_movements (tenant_id, warehouse_id, product_id, variant_id, movement_type, quantity, unit_cost, total_cost, previous_qty, new_qty, previous_avg_cost, new_avg_cost, reference_type, reference_id, transfer_id, notes, created_by)
  VALUES (p_tenant_id, p_warehouse_id, p_product_id, p_variant_id, p_movement_type, p_quantity, p_unit_cost, v_total_cost, v_prev_qty, v_new_qty, v_prev_cost, v_new_cost, p_reference_type, p_reference_id, p_transfer_id, p_notes, p_created_by)
  RETURNING id INTO v_movement_id;
  UPDATE inventory_balances SET quantity_on_hand = v_new_qty, weighted_avg_cost = v_new_cost, last_movement_at = now(), updated_at = now() WHERE id = v_balance.id;
  UPDATE products SET stock_quantity = (SELECT COALESCE(SUM(quantity_on_hand), 0)::INT FROM inventory_balances WHERE product_id = p_product_id AND tenant_id = p_tenant_id) WHERE id = p_product_id;
  RETURN v_movement_id;
END;
$function$;

-- 2j: query_analytics_view
CREATE OR REPLACE FUNCTION public.query_analytics_view(_tenant_id uuid, _view_name text, _columns text[] DEFAULT NULL::text[], _group_by text[] DEFAULT NULL::text[], _period_from date DEFAULT NULL::date, _period_to date DEFAULT NULL::date, _branch_id uuid DEFAULT NULL::uuid, _sort_by text DEFAULT NULL::text, _sort_direction text DEFAULT 'asc'::text, _limit integer DEFAULT 1000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  allowed_views TEXT[] := ARRAY['ar_aging_view','ap_aging_view','balance_sheet_view','cashflow_view','expense_summary_view','profit_loss_view','revenue_summary_view','vat_summary_view'];
  view_columns TEXT[]; safe_columns TEXT[] := '{}'; safe_group TEXT[] := '{}'; col TEXT; query TEXT; result JSONB;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  IF NOT (_view_name = ANY(allowed_views)) THEN RAISE EXCEPTION 'Invalid view name: %', _view_name; END IF;
  SELECT array_agg(column_name::TEXT) INTO view_columns FROM information_schema.columns WHERE table_schema = 'public' AND table_name = _view_name;
  IF _columns IS NOT NULL AND array_length(_columns, 1) > 0 THEN
    FOREACH col IN ARRAY _columns LOOP IF col = ANY(view_columns) AND col != 'tenant_id' THEN safe_columns := safe_columns || col; END IF; END LOOP;
  ELSE
    FOREACH col IN ARRAY view_columns LOOP IF col != 'tenant_id' THEN safe_columns := safe_columns || col; END IF; END LOOP;
  END IF;
  IF array_length(safe_columns, 1) IS NULL THEN RAISE EXCEPTION 'No valid columns selected'; END IF;
  IF _group_by IS NOT NULL AND array_length(_group_by, 1) > 0 THEN
    FOREACH col IN ARRAY _group_by LOOP IF col = ANY(safe_columns) THEN safe_group := safe_group || col; END IF; END LOOP;
  END IF;
  IF array_length(safe_group, 1) > 0 THEN
    DECLARE select_parts TEXT[] := '{}'; c TEXT; col_type TEXT;
    BEGIN
      FOREACH c IN ARRAY safe_group LOOP select_parts := select_parts || quote_ident(c); END LOOP;
      FOREACH c IN ARRAY safe_columns LOOP
        IF NOT (c = ANY(safe_group)) THEN
          SELECT data_type INTO col_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = _view_name AND column_name = c;
          IF col_type IN ('numeric','integer','bigint','double precision','real') THEN select_parts := select_parts || format('SUM(%I) AS %I', c, c); END IF;
        END IF;
      END LOOP;
      query := format('SELECT %s FROM public.%I WHERE tenant_id = $1', array_to_string(select_parts, ', '), _view_name);
    END;
  ELSE
    query := format('SELECT %s FROM public.%I WHERE tenant_id = $1', (SELECT string_agg(quote_ident(c), ', ') FROM unnest(safe_columns) AS c), _view_name);
  END IF;
  IF _period_from IS NOT NULL THEN
    IF 'period' = ANY(view_columns) THEN query := query || format(' AND period >= %L', _period_from);
    ELSIF 'due_date' = ANY(view_columns) THEN query := query || format(' AND due_date >= %L', _period_from); END IF;
  END IF;
  IF _period_to IS NOT NULL THEN
    IF 'period' = ANY(view_columns) THEN query := query || format(' AND period <= %L', _period_to);
    ELSIF 'due_date' = ANY(view_columns) THEN query := query || format(' AND due_date <= %L', _period_to); END IF;
  END IF;
  IF _branch_id IS NOT NULL AND 'branch_id' = ANY(view_columns) THEN query := query || format(' AND branch_id = %L', _branch_id); END IF;
  IF array_length(safe_group, 1) > 0 THEN query := query || ' GROUP BY ' || (SELECT string_agg(quote_ident(c), ', ') FROM unnest(safe_group) AS c); END IF;
  IF _sort_by IS NOT NULL AND _sort_by = ANY(safe_columns) THEN query := query || format(' ORDER BY %I %s', _sort_by, CASE WHEN _sort_direction = 'desc' THEN 'DESC' ELSE 'ASC' END); END IF;
  query := query || format(' LIMIT %s', LEAST(_limit, 5000));
  EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', query) USING _tenant_id INTO result;
  RETURN result;
END;
$function$;

-- 2k: reconcile_invoices_without_journals (no existing check)
CREATE OR REPLACE FUNCTION public.reconcile_invoices_without_journals(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_run_id uuid; v_total_checked int := 0; v_total_matched int := 0; v_total_issues int := 0; v_critical int := 0; v_warning int := 0; rec record;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);
  INSERT INTO reconciliation_runs (tenant_id, run_type, status, started_at, total_checked, total_matched, total_issues, critical_count, warning_count, info_count)
  VALUES (p_tenant_id, 'invoices_without_journals', 'running', now(), 0, 0, 0, 0, 0, 0) RETURNING id INTO v_run_id;
  FOR rec IN
    SELECT i.id, i.invoice_number, i.grand_total, i.invoice_date FROM invoices i
    WHERE i.tenant_id = p_tenant_id AND i.status IN ('approved', 'sent', 'partially_paid', 'paid', 'overdue') AND i.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.tenant_id = p_tenant_id AND je.reference_id = i.id AND je.reference_type = 'invoice')
  LOOP
    v_total_checked := v_total_checked + 1; v_total_issues := v_total_issues + 1; v_critical := v_critical + 1;
    INSERT INTO reconciliation_issues (run_id, tenant_id, severity, issue_type, entity_type, entity_id, entity_label, expected_value, actual_value, difference, description, description_en)
    VALUES (v_run_id, p_tenant_id, 'critical', 'missing_journal', 'invoice', rec.id, rec.invoice_number, rec.grand_total, 0, rec.grand_total,
      'فاتورة معتمدة بدون قيد محاسبي: ' || rec.invoice_number, 'Approved invoice without journal entry: ' || rec.invoice_number);
  END LOOP;
  SELECT count(*) INTO v_total_matched FROM invoices i
  WHERE i.tenant_id = p_tenant_id AND i.status IN ('approved', 'sent', 'partially_paid', 'paid', 'overdue') AND i.deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM journal_entries je WHERE je.tenant_id = p_tenant_id AND je.reference_id = i.id AND je.reference_type = 'invoice');
  v_total_checked := v_total_checked + v_total_matched;
  UPDATE reconciliation_runs SET status = 'completed', completed_at = now(), total_checked = v_total_checked, total_matched = COALESCE(v_total_matched, 0),
    total_issues = v_total_issues, critical_count = v_critical, warning_count = v_warning, info_count = 0 WHERE id = v_run_id;
END;
$function$;

-- 2l: reconcile_unbalanced_journals (no existing check)
CREATE OR REPLACE FUNCTION public.reconcile_unbalanced_journals(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_run_id uuid; v_total_checked int := 0; v_total_matched int := 0; v_total_issues int := 0; v_critical int := 0; rec record;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);
  INSERT INTO reconciliation_runs (tenant_id, run_type, status, started_at, total_checked, total_matched, total_issues, critical_count, warning_count, info_count)
  VALUES (p_tenant_id, 'unbalanced_journals', 'running', now(), 0, 0, 0, 0, 0, 0) RETURNING id INTO v_run_id;
  FOR rec IN
    SELECT je.id, je.entry_number, je.entry_date, COALESCE(SUM(jl.debit), 0) as total_debit, COALESCE(SUM(jl.credit), 0) as total_credit, ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) as diff
    FROM journal_entries je LEFT JOIN journal_lines jl ON jl.entry_id = je.id AND jl.tenant_id = p_tenant_id
    WHERE je.tenant_id = p_tenant_id GROUP BY je.id, je.entry_number, je.entry_date HAVING ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) > 0.01
  LOOP
    v_total_checked := v_total_checked + 1; v_total_issues := v_total_issues + 1; v_critical := v_critical + 1;
    INSERT INTO reconciliation_issues (run_id, tenant_id, severity, issue_type, entity_type, entity_id, entity_label, expected_value, actual_value, difference, description, description_en)
    VALUES (v_run_id, p_tenant_id, 'critical', 'unbalanced_entry', 'journal_entry', rec.id, rec.entry_number, rec.total_debit, rec.total_credit, rec.diff,
      'قيد غير متوازن: ' || rec.entry_number || ' — الفرق: ' || rec.diff, 'Unbalanced journal entry: ' || rec.entry_number || ' — Difference: ' || rec.diff);
  END LOOP;
  SELECT count(*) INTO v_total_matched FROM journal_entries je LEFT JOIN journal_lines jl ON jl.entry_id = je.id AND jl.tenant_id = p_tenant_id
  WHERE je.tenant_id = p_tenant_id GROUP BY je.id HAVING ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) <= 0.01;
  v_total_checked := v_total_checked + COALESCE(v_total_matched, 0);
  UPDATE reconciliation_runs SET status = 'completed', completed_at = now(), total_checked = v_total_checked, total_matched = COALESCE(v_total_matched, 0),
    total_issues = v_total_issues, critical_count = v_critical, warning_count = 0, info_count = 0 WHERE id = v_run_id;
END;
$function$;

-- 2m: record_stock_movement
CREATE OR REPLACE FUNCTION public.record_stock_movement(_product_id uuid, _tenant_id uuid, _movement_type text, _quantity numeric, _reference_type text DEFAULT 'manual'::text, _reference_id uuid DEFAULT NULL::uuid, _notes text DEFAULT NULL::text, _created_by uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _prev_qty numeric; _new_qty numeric;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  SELECT stock_quantity INTO _prev_qty FROM public.products WHERE id = _product_id AND tenant_id = _tenant_id FOR UPDATE;
  IF _movement_type IN ('in', 'return') THEN _new_qty := _prev_qty + _quantity;
  ELSIF _movement_type = 'out' THEN _new_qty := _prev_qty - _quantity;
  ELSIF _movement_type = 'adjustment' THEN _new_qty := _quantity; END IF;
  UPDATE public.products SET stock_quantity = _new_qty WHERE id = _product_id AND tenant_id = _tenant_id;
  INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, notes, created_by)
  VALUES (_tenant_id, _product_id, _movement_type, _quantity, _prev_qty, _new_qty, _reference_type, _reference_id, _notes, COALESCE(_created_by, auth.uid()));
END;
$function$;

-- 2n: release_stock_reservation
CREATE OR REPLACE FUNCTION public.release_stock_reservation(_sales_order_id uuid, _tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _item RECORD; _current_qty numeric;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  FOR _item IN SELECT soi.id, soi.product_id, soi.reserved_quantity FROM public.sales_order_items soi
    WHERE soi.sales_order_id = _sales_order_id AND soi.product_id IS NOT NULL AND soi.reserved_quantity > 0
  LOOP
    SELECT stock_quantity INTO _current_qty FROM public.products WHERE id = _item.product_id FOR UPDATE;
    UPDATE public.products SET stock_quantity = stock_quantity + _item.reserved_quantity WHERE id = _item.product_id;
    UPDATE public.sales_order_items SET reserved_quantity = 0 WHERE id = _item.id;
    INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, notes, created_by)
    VALUES (_tenant_id, _item.product_id, 'in', _item.reserved_quantity, _current_qty, _current_qty + _item.reserved_quantity, 'sales_order', _sales_order_id, 'إلغاء حجز مخزون', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
  END LOOP;
END;
$function$;

-- 2o: reserve_stock_for_order
CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(_sales_order_id uuid, _tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _item RECORD; _available numeric;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  FOR _item IN SELECT soi.id, soi.product_id, soi.quantity, soi.reserved_quantity FROM public.sales_order_items soi
    WHERE soi.sales_order_id = _sales_order_id AND soi.product_id IS NOT NULL
  LOOP
    SELECT stock_quantity INTO _available FROM public.products WHERE id = _item.product_id AND tenant_id = _tenant_id FOR UPDATE;
    IF _available >= _item.quantity THEN
      UPDATE public.products SET stock_quantity = stock_quantity - _item.quantity WHERE id = _item.product_id;
      UPDATE public.sales_order_items SET reserved_quantity = _item.quantity WHERE id = _item.id;
      INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, notes, created_by)
      VALUES (_tenant_id, _item.product_id, 'out', _item.quantity, _available, _available - _item.quantity, 'sales_order', _sales_order_id, 'حجز مخزون لأمر بيع', COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
    ELSE RAISE EXCEPTION 'المخزون غير كافٍ للمنتج %', _item.product_id; END IF;
  END LOOP;
END;
$function$;

-- 2p: sync_budget_actuals_for_tenant
CREATE OR REPLACE FUNCTION public.sync_budget_actuals_for_tenant(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_budget record; v_line record; v_period text; v_actual numeric; v_month_key text; v_year int; v_count int := 0;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);
  FOR v_budget IN SELECT id, fiscal_year FROM budgets WHERE tenant_id = p_tenant_id AND status IN ('active', 'draft')
  LOOP
    FOR v_line IN SELECT id, line_type, period_type, months FROM budget_lines WHERE budget_id = v_budget.id AND tenant_id = p_tenant_id
    LOOP
      v_year := v_budget.fiscal_year;
      IF v_line.period_type = 'monthly' THEN
        FOR i IN 1..12 LOOP
          v_month_key := LPAD(i::text, 2, '0'); v_period := v_year::text || '-' || v_month_key; v_actual := 0;
          IF v_line.line_type = 'expense' THEN
            SELECT COALESCE(SUM(total_amount), 0) INTO v_actual FROM expenses WHERE tenant_id = p_tenant_id AND status = 'approved' AND EXTRACT(YEAR FROM expense_date) = v_year AND EXTRACT(MONTH FROM expense_date) = i;
          ELSIF v_line.line_type = 'revenue' THEN
            SELECT COALESCE(SUM(ip.amount), 0) INTO v_actual FROM invoice_payments ip JOIN invoices inv ON inv.id = ip.invoice_id WHERE ip.tenant_id = p_tenant_id AND EXTRACT(YEAR FROM ip.payment_date) = v_year AND EXTRACT(MONTH FROM ip.payment_date) = i;
          ELSIF v_line.line_type = 'capex' THEN
            SELECT COALESCE(SUM(jel.debit), 0) INTO v_actual FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE je.tenant_id = p_tenant_id AND je.status = 'posted' AND EXTRACT(YEAR FROM je.entry_date) = v_year AND EXTRACT(MONTH FROM je.entry_date) = i;
          END IF;
          INSERT INTO budget_actuals_cache (tenant_id, budget_id, line_id, period, actual_amount, updated_at)
          VALUES (p_tenant_id, v_budget.id, v_line.id, v_period, v_actual, now())
          ON CONFLICT (tenant_id, line_id, period) DO UPDATE SET actual_amount = EXCLUDED.actual_amount, updated_at = now();
          v_count := v_count + 1;
        END LOOP;
      ELSE
        v_period := v_year::text; v_actual := 0;
        IF v_line.line_type = 'expense' THEN
          SELECT COALESCE(SUM(total_amount), 0) INTO v_actual FROM expenses WHERE tenant_id = p_tenant_id AND status = 'approved' AND EXTRACT(YEAR FROM expense_date) = v_year;
        ELSIF v_line.line_type = 'revenue' THEN
          SELECT COALESCE(SUM(ip.amount), 0) INTO v_actual FROM invoice_payments ip JOIN invoices inv ON inv.id = ip.invoice_id WHERE ip.tenant_id = p_tenant_id AND EXTRACT(YEAR FROM ip.payment_date) = v_year;
        ELSIF v_line.line_type = 'capex' THEN
          SELECT COALESCE(SUM(jel.debit), 0) INTO v_actual FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE je.tenant_id = p_tenant_id AND je.status = 'posted' AND EXTRACT(YEAR FROM je.entry_date) = v_year;
        END IF;
        INSERT INTO budget_actuals_cache (tenant_id, budget_id, line_id, period, actual_amount, updated_at)
        VALUES (p_tenant_id, v_budget.id, v_line.id, v_period, v_actual, now())
        ON CONFLICT (tenant_id, line_id, period) DO UPDATE SET actual_amount = EXCLUDED.actual_amount, updated_at = now();
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'records_updated', v_count);
END;
$function$;

-- 2q: validate_subscription_discount
CREATE OR REPLACE FUNCTION public.validate_subscription_discount(_code text, _tenant_id uuid, _plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _discount RECORD; _plan RECORD; _already_used BOOLEAN; _original_price NUMERIC; _new_price NUMERIC; _discount_amount NUMERIC;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  SELECT * INTO _discount FROM public.subscription_discounts WHERE code = UPPER(TRIM(_code));
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'الكود غير موجود'); END IF;
  IF NOT _discount.is_active THEN RETURN jsonb_build_object('success', false, 'error', 'الكود معطل'); END IF;
  IF now() < _discount.starts_at OR now() > _discount.expires_at THEN RETURN jsonb_build_object('success', false, 'error', 'الكود منتهي الصلاحية'); END IF;
  IF _discount.max_uses IS NOT NULL AND _discount.used_count >= _discount.max_uses THEN RETURN jsonb_build_object('success', false, 'error', 'تم استنفاد عدد الاستخدامات المسموح'); END IF;
  IF _discount.eligible_plan_ids IS NOT NULL AND NOT (_plan_id = ANY(_discount.eligible_plan_ids)) THEN RETURN jsonb_build_object('success', false, 'error', 'الكود غير صالح لهذه الخطة'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.subscription_discount_usage WHERE discount_id = _discount.id AND tenant_id = _tenant_id) INTO _already_used;
  IF _already_used THEN RETURN jsonb_build_object('success', false, 'error', 'تم استخدام هذا الكود مسبقاً'); END IF;
  SELECT * INTO _plan FROM public.subscription_plans WHERE id = _plan_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'الخطة غير موجودة'); END IF;
  _original_price := _plan.price_monthly;
  IF _discount.discount_type = 'percentage' THEN _discount_amount := ROUND(_original_price * _discount.discount_value / 100, 2);
  ELSE _discount_amount := LEAST(_discount.discount_value, _original_price); END IF;
  _new_price := GREATEST(_original_price - _discount_amount, 0);
  RETURN jsonb_build_object('success', true, 'discount_id', _discount.id, 'code', _discount.code,
    'discount_type', _discount.discount_type, 'discount_value', _discount.discount_value,
    'amount_before', _original_price, 'amount_after', _new_price, 'discount_amount', _discount_amount);
END;
$function$;

-- 2r: calculate_paylink_fee
CREATE OR REPLACE FUNCTION public.calculate_paylink_fee(_tenant_id uuid, _gross_amount numeric)
 RETURNS TABLE(fee_amount numeric, net_amount numeric, fee_type text, fee_percentage numeric, fee_fixed numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _config RECORD; _fee NUMERIC := 0;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  SELECT * INTO _config FROM public.paylink_fee_configs WHERE tenant_id = _tenant_id AND is_active = true LIMIT 1;
  IF NOT FOUND THEN
    _fee := ROUND(_gross_amount * 0.029, 2);
    RETURN QUERY SELECT _fee, _gross_amount - _fee, 'percentage'::TEXT, 2.9::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  IF _config.fee_type = 'percentage' THEN _fee := ROUND(_gross_amount * (_config.fee_percentage / 100), 2);
  ELSIF _config.fee_type = 'fixed' THEN _fee := _config.fee_fixed_amount;
  ELSIF _config.fee_type = 'combined' THEN _fee := ROUND(_gross_amount * (_config.fee_percentage / 100), 2) + _config.fee_fixed_amount; END IF;
  IF _fee < _config.min_fee THEN _fee := _config.min_fee; END IF;
  IF _config.max_fee IS NOT NULL AND _fee > _config.max_fee THEN _fee := _config.max_fee; END IF;
  RETURN QUERY SELECT _fee, _gross_amount - _fee, _config.fee_type, _config.fee_percentage, _config.fee_fixed_amount;
END;
$function$;

-- 2s: process_affiliate_commission
CREATE OR REPLACE FUNCTION public.process_affiliate_commission(_tenant_id uuid, _subscription_id uuid, _plan_id uuid, _paid_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _tenant RECORD; _affiliate RECORD; _referral RECORD; _commission_amount numeric; _commission_id uuid;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  SELECT * INTO _tenant FROM public.tenants WHERE id = _tenant_id;
  IF _tenant.referral_code IS NULL OR _tenant.referral_code = '' THEN RETURN jsonb_build_object('success', false, 'reason', 'no_referral_code'); END IF;
  SELECT * INTO _affiliate FROM public.affiliates WHERE code = _tenant.referral_code AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'affiliate_not_found_or_inactive'); END IF;
  IF _affiliate.tenant_id = _tenant_id THEN RETURN jsonb_build_object('success', false, 'reason', 'self_referral_blocked'); END IF;
  IF EXISTS (SELECT 1 FROM public.affiliate_commissions WHERE affiliate_id = _affiliate.id AND subscription_id = _subscription_id AND status NOT IN ('cancelled')) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'commission_already_exists');
  END IF;
  SELECT id INTO _referral FROM public.affiliate_referrals WHERE affiliate_id = _affiliate.id AND referred_tenant_id = _tenant_id LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.affiliate_referrals (affiliate_id, referred_tenant_id, subscription_id, source) VALUES (_affiliate.id, _tenant_id, _subscription_id, 'referral_code');
  END IF;
  _commission_amount := ROUND(_paid_amount * _affiliate.commission_rate / 100, 2);
  INSERT INTO public.affiliate_commissions (affiliate_id, subscription_id, tenant_id, gross_amount, net_amount, commission_rate, commission_amount, status)
  VALUES (_affiliate.id, _subscription_id, _tenant_id, _paid_amount, _paid_amount, _affiliate.commission_rate, _commission_amount, 'pending') RETURNING id INTO _commission_id;
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (_tenant_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'commission_created', 'affiliate_commission', _commission_id, _affiliate.code,
    jsonb_build_object('affiliate_id', _affiliate.id, 'paid_amount', _paid_amount, 'commission_rate', _affiliate.commission_rate, 'commission_amount', _commission_amount, 'tier', _affiliate.tier));
  RETURN jsonb_build_object('success', true, 'commission_id', _commission_id, 'affiliate_id', _affiliate.id, 'commission_amount', _commission_amount);
END;
$function$;

-- 2t: check_entitlement (used in RLS — add guard but allow service_role)
CREATE OR REPLACE FUNCTION public.check_entitlement(_tenant_id uuid, _feature_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _sub RECORD; _ent RECORD;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  SELECT s.*, sp.slug AS plan_slug INTO _sub
  FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial','past_due') ORDER BY s.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription'); END IF;
  IF _sub.status = 'trial' THEN RETURN jsonb_build_object('allowed', true, 'reason', 'trial', 'limit', NULL::integer); END IF;
  SELECT * INTO _ent FROM public.plan_entitlements WHERE plan_id = _sub.plan_id AND feature_key = _feature_key;
  IF NOT FOUND OR NOT _ent.is_enabled THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_in_plan', 'plan', _sub.plan_slug); END IF;
  RETURN jsonb_build_object('allowed', true, 'reason', 'entitled', 'plan', _sub.plan_slug, 'limit', _ent.limit_value);
END;
$function$;

-- 2u: check_entitlements_bulk
CREATE OR REPLACE FUNCTION public.check_entitlements_bulk(_tenant_id uuid, _feature_keys text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _sub RECORD; _result JSONB := '{}'::JSONB; _key TEXT; _ent RECORD;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  SELECT s.*, sp.slug AS plan_slug INTO _sub
  FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial','past_due') ORDER BY s.created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    FOREACH _key IN ARRAY _feature_keys LOOP _result := _result || jsonb_build_object(_key, jsonb_build_object('allowed', false, 'reason', 'no_subscription')); END LOOP;
    RETURN _result;
  END IF;
  IF _sub.status = 'trial' THEN
    FOREACH _key IN ARRAY _feature_keys LOOP _result := _result || jsonb_build_object(_key, jsonb_build_object('allowed', true, 'reason', 'trial')); END LOOP;
    RETURN _result;
  END IF;
  FOREACH _key IN ARRAY _feature_keys LOOP
    SELECT * INTO _ent FROM public.plan_entitlements WHERE plan_id = _sub.plan_id AND feature_key = _key;
    IF NOT FOUND OR NOT _ent.is_enabled THEN _result := _result || jsonb_build_object(_key, jsonb_build_object('allowed', false, 'reason', 'not_in_plan'));
    ELSE _result := _result || jsonb_build_object(_key, jsonb_build_object('allowed', true, 'reason', 'entitled', 'limit', _ent.limit_value)); END IF;
  END LOOP;
  RETURN _result;
END;
$function$;

-- 2v: check_storage_limit
CREATE OR REPLACE FUNCTION public.check_storage_limit(_tenant_id uuid, _file_size_bytes bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _sub RECORD; _used_bytes bigint; _used_gb numeric; _limit_bytes bigint;
BEGIN
  PERFORM public.assert_tenant_member(_tenant_id);
  SELECT s.status, sp.max_storage_gb INTO _sub FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial','past_due') ORDER BY s.created_at DESC LIMIT 1;
  IF _sub.status = 'trial' THEN RETURN jsonb_build_object('allowed', true, 'reason', 'trial'); END IF;
  IF _sub.max_storage_gb IS NULL THEN RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited'); END IF;
  SELECT COALESCE(sum((o.metadata->>'size')::bigint), 0) INTO _used_bytes FROM storage.objects o WHERE o.name LIKE _tenant_id::text || '/%';
  _used_gb := (_used_bytes + _file_size_bytes) / (1024.0 * 1024 * 1024);
  _limit_bytes := _sub.max_storage_gb::bigint * 1024 * 1024 * 1024;
  IF (_used_bytes + _file_size_bytes) > _limit_bytes THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'storage_limit_exceeded', 'used_gb', ROUND(_used_bytes / (1024.0 * 1024 * 1024), 2), 'limit_gb', _sub.max_storage_gb,
      'message', 'تم تجاوز حد التخزين المسموح (' || _sub.max_storage_gb || ' GB). يرجى ترقية الباقة.');
  END IF;
  RETURN jsonb_build_object('allowed', true, 'used_gb', ROUND(_used_bytes / (1024.0 * 1024 * 1024), 2), 'limit_gb', _sub.max_storage_gb);
END;
$function$;

-- 2w: enforce_feature_entitlement
CREATE OR REPLACE FUNCTION public.enforce_feature_entitlement(_tenant_id uuid, _feature_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _result jsonb;
BEGIN
  -- No assert here - called from RLS policies where auth context is already verified
  -- assert_tenant_member is called inside check_entitlement
  _result := public.check_entitlement(_tenant_id, _feature_key);
  RETURN (_result->>'allowed')::boolean;
END;
$function$;
