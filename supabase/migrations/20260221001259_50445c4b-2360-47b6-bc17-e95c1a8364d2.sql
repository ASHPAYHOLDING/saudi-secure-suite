
-- Background Job Queue System
CREATE TABLE public.background_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_job_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'processing', 'completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid job status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_job_status
  BEFORE INSERT OR UPDATE ON public.background_jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_job_status();

-- Indexes for efficient polling
CREATE INDEX idx_bg_jobs_poll ON public.background_jobs (status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_bg_jobs_tenant ON public.background_jobs (tenant_id, created_at DESC);
CREATE INDEX idx_bg_jobs_type ON public.background_jobs (type, status);

-- Atomic claim function: claims the next pending job for processing
CREATE OR REPLACE FUNCTION public.claim_next_job(p_job_types TEXT[] DEFAULT NULL)
RETURNS SETOF public.background_jobs AS $$
  UPDATE public.background_jobs
  SET status = 'processing', started_at = now(), attempts = attempts + 1
  WHERE id = (
    SELECT id FROM public.background_jobs
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND attempts < max_attempts
      AND (p_job_types IS NULL OR type = ANY(p_job_types))
    ORDER BY scheduled_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql SET search_path = public;

-- Complete a job
CREATE OR REPLACE FUNCTION public.complete_job(p_job_id UUID, p_result JSONB DEFAULT NULL)
RETURNS VOID AS $$
  UPDATE public.background_jobs
  SET status = 'completed', completed_at = now(), result = p_result
  WHERE id = p_job_id;
$$ LANGUAGE sql SET search_path = public;

-- Fail a job (re-queue if under max_attempts)
CREATE OR REPLACE FUNCTION public.fail_job(p_job_id UUID, p_error TEXT DEFAULT NULL)
RETURNS VOID AS $$
  UPDATE public.background_jobs
  SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
      error_message = p_error,
      started_at = NULL
  WHERE id = p_job_id;
$$ LANGUAGE sql SET search_path = public;

-- Revoke public execute on these functions
REVOKE EXECUTE ON FUNCTION public.claim_next_job FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_job FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_job FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_job TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_job TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_job TO service_role;

-- RLS
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant jobs"
  ON public.background_jobs FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert jobs for own tenant"
  ON public.background_jobs FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access"
  ON public.background_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Stale job cleanup: re-queue jobs stuck in processing > 10 min
CREATE OR REPLACE FUNCTION public.requeue_stale_jobs()
RETURNS INT AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE public.background_jobs
  SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
      started_at = NULL,
      error_message = 'Stale: exceeded processing timeout'
  WHERE status = 'processing'
    AND started_at < now() - interval '10 minutes';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.requeue_stale_jobs FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_stale_jobs TO service_role;
