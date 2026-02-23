-- Create unique index first for idempotent seeding
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_key_locale_scope_platform
ON public.email_templates (template_key, locale, scope) WHERE tenant_id IS NULL;
