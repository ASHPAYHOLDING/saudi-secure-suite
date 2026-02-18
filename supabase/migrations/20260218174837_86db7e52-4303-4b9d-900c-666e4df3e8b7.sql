
-- 1) Create enums
CREATE TYPE public.budget_status AS ENUM ('draft', 'active', 'locked', 'archived');
CREATE TYPE public.budget_line_type AS ENUM ('revenue', 'expense', 'capex');
CREATE TYPE public.budget_period_type AS ENUM ('monthly', 'quarterly', 'yearly');
CREATE TYPE public.budget_alert_scope AS ENUM ('budget_total', 'line', 'cost_center', 'department');
CREATE TYPE public.budget_alert_event_status AS ENUM ('triggered', 'acknowledged', 'resolved');

-- 2) budgets table
CREATE TABLE public.budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  fiscal_year int NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  currency text NOT NULL DEFAULT 'SAR',
  status public.budget_status NOT NULL DEFAULT 'draft',
  version int NOT NULL DEFAULT 1,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) budget_lines table
CREATE TABLE public.budget_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  line_type public.budget_line_type NOT NULL DEFAULT 'expense',
  account_id uuid,
  cost_center_id uuid,
  department_id uuid REFERENCES public.departments(id),
  project_id uuid,
  period_type public.budget_period_type NOT NULL DEFAULT 'monthly',
  months jsonb DEFAULT '{"01":0,"02":0,"03":0,"04":0,"05":0,"06":0,"07":0,"08":0,"09":0,"10":0,"11":0,"12":0}',
  planned_amount numeric DEFAULT 0,
  notes text,
  description_ar text,
  description_en text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) budget_actuals_cache
CREATE TABLE public.budget_actuals_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES public.budget_lines(id) ON DELETE CASCADE,
  period text NOT NULL,
  actual_amount numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, line_id, period)
);

-- 5) budget_alert_rules
CREATE TABLE public.budget_alert_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  threshold_percent int NOT NULL DEFAULT 80,
  scope public.budget_alert_scope NOT NULL DEFAULT 'budget_total',
  notify_channels jsonb NOT NULL DEFAULT '["in_app"]',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) budget_alert_events
CREATE TABLE public.budget_alert_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  line_id uuid REFERENCES public.budget_lines(id) ON DELETE SET NULL,
  period text,
  percent_used numeric,
  status public.budget_alert_event_status NOT NULL DEFAULT 'triggered',
  message_ar text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7) Indexes
CREATE INDEX idx_budgets_tenant ON public.budgets(tenant_id);
CREATE INDEX idx_budgets_fiscal_year ON public.budgets(tenant_id, fiscal_year);
CREATE INDEX idx_budget_lines_budget ON public.budget_lines(budget_id);
CREATE INDEX idx_budget_actuals_cache_line ON public.budget_actuals_cache(line_id, period);
CREATE INDEX idx_budget_alert_events_budget ON public.budget_alert_events(budget_id);

-- 8) Enable RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_actuals_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_alert_events ENABLE ROW LEVEL SECURITY;

-- 9) RLS Policies
CREATE POLICY "budgets_select" ON public.budgets FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budgets_insert" ON public.budgets FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budgets_update" ON public.budgets FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budgets_delete" ON public.budgets FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "budget_lines_select" ON public.budget_lines FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budget_lines_insert" ON public.budget_lines FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budget_lines_update" ON public.budget_lines FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budget_lines_delete" ON public.budget_lines FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "budget_actuals_select" ON public.budget_actuals_cache FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budget_actuals_insert" ON public.budget_actuals_cache FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budget_actuals_update" ON public.budget_actuals_cache FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "budget_alert_rules_select" ON public.budget_alert_rules FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budget_alert_rules_insert" ON public.budget_alert_rules FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budget_alert_rules_update" ON public.budget_alert_rules FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budget_alert_rules_delete" ON public.budget_alert_rules FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "budget_alert_events_select" ON public.budget_alert_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budget_alert_events_insert" ON public.budget_alert_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "budget_alert_events_update" ON public.budget_alert_events FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 10) Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_lines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_actuals_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_alert_events;

-- 11) RPC: activate_budget
CREATE OR REPLACE FUNCTION public.activate_budget(p_budget_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget record;
  v_tenant_id uuid;
BEGIN
  SELECT b.* INTO v_budget FROM budgets b WHERE b.id = p_budget_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الميزانية غير موجودة');
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM tenant_members WHERE user_id = auth.uid() AND tenant_id = v_budget.tenant_id;
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  IF v_budget.status::text != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن تفعيل ميزانية بحالة: ' || v_budget.status::text);
  END IF;

  UPDATE budgets SET status = 'archived', updated_at = now()
  WHERE tenant_id = v_budget.tenant_id AND fiscal_year = v_budget.fiscal_year AND status = 'active' AND id != p_budget_id;

  UPDATE budgets SET status = 'active', updated_at = now() WHERE id = p_budget_id;

  INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, entity_label)
  VALUES (v_budget.tenant_id, auth.uid(), 'budget', p_budget_id::text, 'activated', v_budget.name_ar);

  RETURN jsonb_build_object('success', true, 'message', 'تم تفعيل الميزانية بنجاح');
END;
$$;

-- 12) Audit trigger
CREATE OR REPLACE FUNCTION public.audit_budget_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, entity_label, changes)
    VALUES (NEW.tenant_id, COALESCE(auth.uid(), NEW.created_by), 'budget', NEW.id::text, 'created', NEW.name_ar, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, entity_label, changes)
    VALUES (NEW.tenant_id, COALESCE(auth.uid(), NEW.created_by), 'budget', NEW.id::text, 'updated', NEW.name_ar,
      jsonb_build_object('old_status', OLD.status::text, 'new_status', NEW.status::text, 'old_version', OLD.version, 'new_version', NEW.version));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_budgets
  AFTER INSERT OR UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.audit_budget_changes();

-- 13) Updated_at trigger
CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
