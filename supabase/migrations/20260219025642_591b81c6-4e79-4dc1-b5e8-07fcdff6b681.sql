
-- Immutable edge request logs for observability
CREATE TABLE public.edge_request_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  function_name TEXT NOT NULL,
  action TEXT,
  user_id UUID,
  tenant_id UUID,
  ip_address TEXT,
  method TEXT NOT NULL DEFAULT 'POST',
  status_code INT NOT NULL DEFAULT 200,
  duration_ms INT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_edge_req_logs_tenant_created ON public.edge_request_logs (tenant_id, created_at DESC);
CREATE INDEX idx_edge_req_logs_correlation ON public.edge_request_logs (correlation_id);
CREATE INDEX idx_edge_req_logs_function ON public.edge_request_logs (function_name, created_at DESC);

-- Enable RLS
ALTER TABLE public.edge_request_logs ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert (edge functions use service client)
-- No select for regular users — admin only via service_role
CREATE POLICY "Service role full access" ON public.edge_request_logs
  FOR ALL USING (false) WITH CHECK (false);

-- Prevent any updates or deletes (immutable)
CREATE OR REPLACE FUNCTION public.prevent_edge_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'edge_request_logs is immutable: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_prevent_edge_log_update
  BEFORE UPDATE ON public.edge_request_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_edge_log_mutation();

CREATE TRIGGER trg_prevent_edge_log_delete
  BEFORE DELETE ON public.edge_request_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_edge_log_mutation();

-- Add correlation_id column to audit_logs for end-to-end tracing
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS correlation_id TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON public.audit_logs (correlation_id);
