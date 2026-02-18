
-- Period locks table
CREATE TABLE public.period_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by UUID NOT NULL,
  unlocked_at TIMESTAMPTZ,
  unlocked_by UUID,
  lock_reason TEXT DEFAULT 'إقفال شهري',
  unlock_reason TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period_year, period_month)
);

ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant members can view period locks"
  ON public.period_locks FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can manage period locks"
  ON public.period_locks FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can update period locks"
  ON public.period_locks FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- Security definer function to check if a period is locked for a tenant
CREATE OR REPLACE FUNCTION public.is_period_locked(_tenant_id UUID, _date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.period_locks
    WHERE tenant_id = _tenant_id
      AND period_year = EXTRACT(YEAR FROM _date)::INT
      AND period_month = EXTRACT(MONTH FROM _date)::INT
      AND is_locked = true
  );
$$;

-- Trigger to prevent INSERT/UPDATE/DELETE on journal_entries in locked periods
CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry_date DATE;
  _tid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _entry_date := OLD.entry_date;
    _tid := OLD.tenant_id;
  ELSE
    _entry_date := NEW.entry_date;
    _tid := NEW.tenant_id;
  END IF;

  IF public.is_period_locked(_tid, _entry_date) THEN
    RAISE EXCEPTION 'الفترة المحاسبية مقفلة — لا يمكن تعديل القيود في %/% ',
      EXTRACT(MONTH FROM _entry_date)::INT,
      EXTRACT(YEAR FROM _entry_date)::INT;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_period_lock_on_journal
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_period_lock();

-- Also protect expenses
CREATE TRIGGER enforce_period_lock_on_expenses
  BEFORE INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_period_lock();

-- Also protect invoices (using invoice_date as entry_date equivalent)
CREATE OR REPLACE FUNCTION public.enforce_period_lock_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv_date DATE;
  _tid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _inv_date := OLD.invoice_date;
    _tid := OLD.tenant_id;
  ELSE
    _inv_date := NEW.invoice_date;
    _tid := NEW.tenant_id;
  END IF;

  IF public.is_period_locked(_tid, _inv_date) THEN
    RAISE EXCEPTION 'الفترة المحاسبية مقفلة — لا يمكن تعديل الفواتير في %/% ',
      EXTRACT(MONTH FROM _inv_date)::INT,
      EXTRACT(YEAR FROM _inv_date)::INT;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_period_lock_on_invoices
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_period_lock_invoices();
