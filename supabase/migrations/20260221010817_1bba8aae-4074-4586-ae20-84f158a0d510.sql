
-- Add financial_controls column to tenant_settings
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS financial_controls JSONB NOT NULL DEFAULT jsonb_build_object(
    'require_dual_approval', false,
    'thresholds', jsonb_build_array(
      jsonb_build_object('entity_type', 'payment', 'min_amount', 50000, 'roles_required', ARRAY['cfo','finance_manager']),
      jsonb_build_object('entity_type', 'wallet_transfer', 'min_amount', 50000, 'roles_required', ARRAY['cfo','finance_manager']),
      jsonb_build_object('entity_type', 'expense', 'min_amount', 50000, 'roles_required', ARRAY['cfo','finance_manager'])
    )
  );

-- Dual approval requests table
CREATE TABLE public.dual_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('payment','wallet_transfer','expense')),
  entity_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dual approval actions (each approval/rejection)
CREATE TABLE public.dual_approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.dual_approval_requests(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  acted_by UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved','rejected')),
  comment TEXT,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.dual_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dual_approval_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view dual approval requests"
  ON public.dual_approval_requests FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert dual approval requests"
  ON public.dual_approval_requests FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can view dual approval actions"
  ON public.dual_approval_actions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert dual approval actions"
  ON public.dual_approval_actions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_dar_tenant_status ON public.dual_approval_requests (tenant_id, status);
CREATE INDEX idx_dar_entity ON public.dual_approval_requests (tenant_id, entity_type, entity_id);
CREATE INDEX idx_daa_request ON public.dual_approval_actions (request_id);

-- Unique constraint: same user can't approve twice on same request
ALTER TABLE public.dual_approval_actions
  ADD CONSTRAINT uq_dual_action_user UNIQUE (request_id, acted_by);

-- Function: check if dual approval is required for an amount
CREATE OR REPLACE FUNCTION public.check_dual_approval_required(
  p_tenant_id UUID,
  p_entity_type TEXT,
  p_amount NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_controls JSONB;
  v_threshold JSONB;
  v_item JSONB;
BEGIN
  SELECT financial_controls INTO v_controls
  FROM public.tenant_settings
  WHERE tenant_id = p_tenant_id;

  IF v_controls IS NULL OR NOT (v_controls->>'require_dual_approval')::boolean THEN
    RETURN false;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_controls->'thresholds')
  LOOP
    IF v_item->>'entity_type' = p_entity_type AND p_amount >= (v_item->>'min_amount')::numeric THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Function: submit dual approval action
CREATE OR REPLACE FUNCTION public.submit_dual_approval(
  p_request_id UUID,
  p_action TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_request RECORD;
  v_actor UUID;
  v_approval_count INT;
  v_new_status TEXT;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request FROM public.dual_approval_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.status != 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  -- Cannot approve own request
  IF v_request.requested_by = v_actor THEN
    RAISE EXCEPTION 'Cannot approve your own request';
  END IF;

  -- Record the action
  INSERT INTO public.dual_approval_actions (request_id, tenant_id, acted_by, action, comment)
  VALUES (p_request_id, v_request.tenant_id, v_actor, p_action, p_comment);

  -- If rejected, immediately reject the whole request
  IF p_action = 'rejected' THEN
    UPDATE public.dual_approval_requests
    SET status = 'rejected', completed_at = now()
    WHERE id = p_request_id;

    -- Audit
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (v_request.tenant_id, v_actor, 'dual_approval_rejected', v_request.entity_type, v_request.entity_id::text, NULL,
      jsonb_build_object('amount', v_request.amount, 'comment', p_comment));

    RETURN 'rejected';
  END IF;

  -- Count approvals
  SELECT COUNT(*) INTO v_approval_count
  FROM public.dual_approval_actions
  WHERE request_id = p_request_id AND action = 'approved';

  IF v_approval_count >= 2 THEN
    UPDATE public.dual_approval_requests
    SET status = 'approved', completed_at = now()
    WHERE id = p_request_id;

    -- Audit
    INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
    VALUES (v_request.tenant_id, v_actor, 'dual_approval_completed', v_request.entity_type, v_request.entity_id::text, NULL,
      jsonb_build_object('amount', v_request.amount, 'approvals', v_approval_count));

    RETURN 'approved';
  END IF;

  -- First approval recorded, still pending second
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label, changes)
  VALUES (v_request.tenant_id, v_actor, 'dual_approval_first', v_request.entity_type, v_request.entity_id::text, NULL,
    jsonb_build_object('amount', v_request.amount, 'approvals_so_far', v_approval_count));

  RETURN 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Secure access
REVOKE EXECUTE ON FUNCTION public.submit_dual_approval FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_dual_approval TO service_role;
