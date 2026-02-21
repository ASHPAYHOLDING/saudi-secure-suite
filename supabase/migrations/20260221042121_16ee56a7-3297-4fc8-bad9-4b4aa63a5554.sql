
-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Domain-Driven Architecture: domain_events + namespaced RPCs ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── 1. Domain Events Table ──────────────────────────────────────
CREATE TABLE public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  domain text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  source_entity_id text,
  source_entity_type text,
  correlation_id uuid DEFAULT gen_random_uuid(),
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation on domain_events"
  ON public.domain_events FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_domain_events_tenant_domain ON public.domain_events(tenant_id, domain, created_at DESC);
CREATE INDEX idx_domain_events_unprocessed ON public.domain_events(processed, created_at) WHERE NOT processed;

-- ── 2. Domain Event Publisher ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.publish_domain_event(
  p_tenant_id uuid,
  p_domain text,
  p_event_type text,
  p_payload jsonb DEFAULT '{}',
  p_source_entity_id text DEFAULT NULL,
  p_source_entity_type text DEFAULT NULL,
  p_correlation_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO domain_events (tenant_id, domain, event_type, payload, source_entity_id, source_entity_type, correlation_id)
  VALUES (p_tenant_id, p_domain, p_event_type, p_payload, p_source_entity_id, p_source_entity_type, COALESCE(p_correlation_id, gen_random_uuid()))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── 3. Domain Event Consumer (mark processed) ──────────────────
CREATE OR REPLACE FUNCTION public.consume_domain_events(
  p_domain text,
  p_limit integer DEFAULT 50
)
RETURNS SETOF domain_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE domain_events
  SET processed = true, processed_at = now()
  WHERE id IN (
    SELECT id FROM domain_events
    WHERE domain = p_domain AND NOT processed
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- ── 4. ACCOUNTING Domain Functions ──────────────────────────────
-- Wrapper: accounting_post_journal
CREATE OR REPLACE FUNCTION public.accounting_post_journal(
  p_tenant_id uuid,
  p_journal_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Post the journal entry using existing logic
  UPDATE journal_entries SET status = 'posted', posted_at = now()
  WHERE id = p_journal_id AND tenant_id = p_tenant_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found or not in draft status';
  END IF;

  -- Emit domain event
  PERFORM publish_domain_event(
    p_tenant_id, 'accounting', 'journal_posted',
    jsonb_build_object('journal_id', p_journal_id),
    p_journal_id::text, 'journal_entry'
  );
END;
$$;

-- Wrapper: accounting_close_period
CREATE OR REPLACE FUNCTION public.accounting_close_period(
  p_tenant_id uuid,
  p_period_id uuid,
  p_closed_by uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE accounting_periods
  SET status = 'closed', closed_at = now(), closed_by = p_closed_by::text
  WHERE id = p_period_id AND tenant_id = p_tenant_id AND status = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Period not found or not open';
  END IF;

  PERFORM publish_domain_event(
    p_tenant_id, 'accounting', 'period_closed',
    jsonb_build_object('period_id', p_period_id, 'closed_by', p_closed_by),
    p_period_id::text, 'accounting_period'
  );
END;
$$;

-- ── 5. BILLING Domain Functions ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.billing_create_invoice(
  p_tenant_id uuid,
  p_invoice_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  -- Insert invoice from JSON payload
  INSERT INTO invoices (
    tenant_id, customer_id, invoice_number, status, subtotal, tax_amount, total,
    currency_code, created_by, branch_id
  )
  VALUES (
    p_tenant_id,
    (p_invoice_data->>'customer_id')::uuid,
    p_invoice_data->>'invoice_number',
    COALESCE(p_invoice_data->>'status', 'draft'),
    COALESCE((p_invoice_data->>'subtotal')::numeric, 0),
    COALESCE((p_invoice_data->>'tax_amount')::numeric, 0),
    COALESCE((p_invoice_data->>'total')::numeric, 0),
    COALESCE(p_invoice_data->>'currency_code', 'SAR'),
    (p_invoice_data->>'created_by')::uuid,
    (p_invoice_data->>'branch_id')::uuid
  )
  RETURNING id INTO v_invoice_id;

  PERFORM publish_domain_event(
    p_tenant_id, 'billing', 'invoice_created',
    jsonb_build_object('invoice_id', v_invoice_id, 'total', p_invoice_data->>'total'),
    v_invoice_id::text, 'invoice'
  );

  RETURN v_invoice_id;
END;
$$;

-- ── 6. INVENTORY Domain Functions ───────────────────────────────
CREATE OR REPLACE FUNCTION public.inventory_adjust_stock(
  p_tenant_id uuid,
  p_product_id uuid,
  p_quantity_change numeric,
  p_reason text DEFAULT 'manual_adjustment',
  p_adjusted_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_qty numeric;
  v_new_qty numeric;
BEGIN
  SELECT COALESCE(stock_quantity, 0) INTO v_old_qty
  FROM products WHERE id = p_product_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_new_qty := v_old_qty + p_quantity_change;

  UPDATE products SET stock_quantity = v_new_qty, updated_at = now()
  WHERE id = p_product_id AND tenant_id = p_tenant_id;

  PERFORM publish_domain_event(
    p_tenant_id, 'inventory', 'stock_adjusted',
    jsonb_build_object(
      'product_id', p_product_id, 'old_qty', v_old_qty,
      'new_qty', v_new_qty, 'change', p_quantity_change, 'reason', p_reason
    ),
    p_product_id::text, 'product'
  );
END;
$$;

-- ── 7. CRM Domain Functions ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crm_create_customer(
  p_tenant_id uuid,
  p_customer_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  INSERT INTO customers (
    tenant_id, name, email, phone, tax_number, address, customer_type, created_by
  )
  VALUES (
    p_tenant_id,
    p_customer_data->>'name',
    p_customer_data->>'email',
    p_customer_data->>'phone',
    p_customer_data->>'tax_number',
    p_customer_data->>'address',
    COALESCE(p_customer_data->>'customer_type', 'individual'),
    (p_customer_data->>'created_by')::uuid
  )
  RETURNING id INTO v_customer_id;

  PERFORM publish_domain_event(
    p_tenant_id, 'crm', 'customer_created',
    jsonb_build_object('customer_id', v_customer_id, 'name', p_customer_data->>'name'),
    v_customer_id::text, 'customer'
  );

  RETURN v_customer_id;
END;
$$;

-- ── 8. GOVERNANCE Domain Functions ──────────────────────────────
CREATE OR REPLACE FUNCTION public.governance_log_violation(
  p_tenant_id uuid,
  p_violation_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO policy_violations (
    tenant_id, policy_type, violation_type, severity, entity_type, entity_id,
    details, user_id
  )
  VALUES (
    p_tenant_id,
    p_violation_data->>'policy_type',
    p_violation_data->>'violation_type',
    COALESCE(p_violation_data->>'severity', 'medium'),
    p_violation_data->>'entity_type',
    p_violation_data->>'entity_id',
    p_violation_data->'details',
    (p_violation_data->>'user_id')::uuid
  )
  RETURNING id INTO v_id;

  PERFORM publish_domain_event(
    p_tenant_id, 'governance', 'violation_logged',
    jsonb_build_object('violation_id', v_id, 'severity', p_violation_data->>'severity'),
    v_id::text, 'policy_violation'
  );

  RETURN v_id;
END;
$$;

-- ── 9. HR Domain Functions ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_invite_member(
  p_tenant_id uuid,
  p_email text,
  p_role text DEFAULT 'viewer',
  p_invited_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite_id uuid;
BEGIN
  INSERT INTO team_invitations (tenant_id, email, role, invited_by, status)
  VALUES (p_tenant_id, p_email, p_role, p_invited_by, 'pending')
  RETURNING id INTO v_invite_id;

  PERFORM publish_domain_event(
    p_tenant_id, 'hr', 'member_invited',
    jsonb_build_object('email', p_email, 'role', p_role, 'invite_id', v_invite_id),
    v_invite_id::text, 'team_invitation'
  );

  RETURN v_invite_id;
END;
$$;

-- ── 10. INTEGRATIONS Domain Function ────────────────────────────
CREATE OR REPLACE FUNCTION public.integrations_log_event(
  p_tenant_id uuid,
  p_provider text,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  v_event_id := gen_random_uuid();

  PERFORM publish_domain_event(
    p_tenant_id, 'integrations', p_event_type,
    jsonb_build_object('provider', p_provider, 'payload', p_payload),
    v_event_id::text, 'integration'
  );

  RETURN v_event_id;
END;
$$;

-- ── 11. Domain Events Query Function ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_domain_events(
  p_tenant_id uuid,
  p_domain text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS SETOF domain_events
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM domain_events
  WHERE tenant_id = p_tenant_id
    AND (p_domain IS NULL OR domain = p_domain)
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

-- Revoke direct execution from public
REVOKE EXECUTE ON FUNCTION public.publish_domain_event FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_domain_event TO service_role;

REVOKE EXECUTE ON FUNCTION public.consume_domain_events FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_domain_events TO service_role;

REVOKE EXECUTE ON FUNCTION public.accounting_post_journal FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_post_journal TO service_role;

REVOKE EXECUTE ON FUNCTION public.accounting_close_period FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_close_period TO service_role;

REVOKE EXECUTE ON FUNCTION public.billing_create_invoice FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_create_invoice TO service_role;

REVOKE EXECUTE ON FUNCTION public.inventory_adjust_stock FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_adjust_stock TO service_role;

REVOKE EXECUTE ON FUNCTION public.crm_create_customer FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_create_customer TO service_role;

REVOKE EXECUTE ON FUNCTION public.governance_log_violation FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.governance_log_violation TO service_role;

REVOKE EXECUTE ON FUNCTION public.hr_invite_member FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hr_invite_member TO service_role;

REVOKE EXECUTE ON FUNCTION public.integrations_log_event FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integrations_log_event TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_domain_events FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_domain_events TO service_role;
