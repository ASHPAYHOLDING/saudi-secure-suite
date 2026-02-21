
-- Add SLA columns to workflow_instance_steps
ALTER TABLE public.workflow_instance_steps
  ADD COLUMN due_at TIMESTAMPTZ,
  ADD COLUMN sla_status TEXT NOT NULL DEFAULT 'on_time'
    CHECK (sla_status IN ('on_time', 'warning', 'late'));

-- Auto-set due_at from workflow_steps.timeout_hours on insert
CREATE OR REPLACE FUNCTION public.set_step_due_at()
RETURNS TRIGGER AS $$
DECLARE
  v_timeout INTEGER;
BEGIN
  SELECT timeout_hours INTO v_timeout
  FROM public.workflow_steps
  WHERE id = NEW.step_id;

  IF v_timeout IS NOT NULL AND v_timeout > 0 THEN
    NEW.due_at := NEW.created_at + (v_timeout || ' hours')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_set_step_due_at
  BEFORE INSERT ON public.workflow_instance_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.set_step_due_at();

-- Function to check and update SLA statuses + generate notifications
CREATE OR REPLACE FUNCTION public.check_sla_deadlines()
RETURNS void AS $$
DECLARE
  r RECORD;
  v_step_name TEXT;
  v_entity_label TEXT;
  v_approver_ids UUID[];
BEGIN
  -- Mark late steps
  UPDATE public.workflow_instance_steps
  SET sla_status = 'late'
  WHERE status = 'pending'
    AND due_at IS NOT NULL
    AND due_at < NOW()
    AND sla_status != 'late';

  -- Mark warning steps (within 24h)
  UPDATE public.workflow_instance_steps
  SET sla_status = 'warning'
  WHERE status = 'pending'
    AND due_at IS NOT NULL
    AND due_at >= NOW()
    AND due_at < NOW() + INTERVAL '24 hours'
    AND sla_status = 'on_time';

  -- Generate notifications for newly late steps
  FOR r IN
    SELECT wis.id AS step_instance_id, wis.instance_id, wis.step_id, wis.tenant_id, wis.due_at,
           wi.entity_id, wi.entity_type, wi.started_by
    FROM public.workflow_instance_steps wis
    JOIN public.workflow_instances wi ON wi.id = wis.instance_id
    WHERE wis.status = 'pending'
      AND wis.sla_status = 'late'
      AND wis.due_at < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.collaboration_notifications cn
        WHERE cn.reference_id = wis.id::text
          AND cn.type = 'sla_escalation'
      )
  LOOP
    -- Get step name
    SELECT name INTO v_step_name FROM public.workflow_steps WHERE id = r.step_id;

    -- Notify the workflow starter about escalation
    INSERT INTO public.collaboration_notifications (tenant_id, user_id, actor_id, type, message, reference_id, entity_type, entity_id)
    VALUES (
      r.tenant_id,
      r.started_by,
      r.started_by,
      'sla_escalation',
      'تأخرت خطوة "' || COALESCE(v_step_name, 'موافقة') || '" عن الموعد المحدد',
      r.step_instance_id::text,
      r.entity_type,
      r.entity_id::text
    );
  END LOOP;

  -- Generate warning notifications (24h before)
  FOR r IN
    SELECT wis.id AS step_instance_id, wis.instance_id, wis.step_id, wis.tenant_id, wis.due_at,
           wi.entity_id, wi.entity_type, wi.started_by
    FROM public.workflow_instance_steps wis
    JOIN public.workflow_instances wi ON wi.id = wis.instance_id
    WHERE wis.status = 'pending'
      AND wis.sla_status = 'warning'
      AND NOT EXISTS (
        SELECT 1 FROM public.collaboration_notifications cn
        WHERE cn.reference_id = wis.id::text
          AND cn.type = 'sla_warning'
      )
  LOOP
    SELECT name INTO v_step_name FROM public.workflow_steps WHERE id = r.step_id;

    INSERT INTO public.collaboration_notifications (tenant_id, user_id, actor_id, type, message, reference_id, entity_type, entity_id)
    VALUES (
      r.tenant_id,
      r.started_by,
      r.started_by,
      'sla_warning',
      'خطوة "' || COALESCE(v_step_name, 'موافقة') || '" ستنتهي خلال 24 ساعة',
      r.step_instance_id::text,
      r.entity_type,
      r.entity_id::text
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Index for efficient SLA queries
CREATE INDEX idx_wis_sla_pending ON public.workflow_instance_steps (due_at) WHERE status = 'pending' AND due_at IS NOT NULL;
