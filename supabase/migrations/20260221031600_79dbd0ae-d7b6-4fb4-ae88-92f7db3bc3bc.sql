
-- Integration-specific documentation content system
-- Each provider has its own unique setup guide, FAQ, troubleshooting, security notes

CREATE TABLE public.integration_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT '',
  title_en text,
  short_description text NOT NULL DEFAULT '',
  short_description_en text,
  setup_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  troubleshooting jsonb NOT NULL DEFAULT '[]'::jsonb,
  security_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  screenshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_docs ENABLE ROW LEVEL SECURITY;

-- Public read for all authenticated users (docs are not tenant-specific)
CREATE POLICY "Authenticated users can read integration docs"
  ON public.integration_docs
  FOR SELECT
  TO authenticated
  USING (true);

-- Platform admins can manage docs (via edge function / service_role)
-- No direct INSERT/UPDATE/DELETE for regular users

-- Trigger to auto-update updated_at
CREATE TRIGGER update_integration_docs_updated_at
  BEFORE UPDATE ON public.integration_docs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
