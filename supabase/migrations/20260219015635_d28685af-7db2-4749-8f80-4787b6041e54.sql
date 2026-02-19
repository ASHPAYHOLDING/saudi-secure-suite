
CREATE TABLE public.client_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  route TEXT,
  error_message TEXT NOT NULL,
  stack TEXT,
  device_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own errors"
  ON public.client_errors FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own errors"
  ON public.client_errors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins see all errors"
  ON public.client_errors FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_client_errors_user ON public.client_errors(user_id);
CREATE INDEX idx_client_errors_tenant ON public.client_errors(tenant_id);
CREATE INDEX idx_client_errors_created ON public.client_errors(created_at DESC);
