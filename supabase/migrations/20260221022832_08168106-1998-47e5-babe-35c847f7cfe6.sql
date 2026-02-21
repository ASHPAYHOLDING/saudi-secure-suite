
-- ═══════════════════════════════════════════
-- 1. Create legal_entities table
-- ═══════════════════════════════════════════
CREATE TABLE public.legal_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text,
  tax_number text,
  country_code text NOT NULL DEFAULT 'SA',
  currency_code text NOT NULL DEFAULT 'SAR',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one default per tenant
CREATE UNIQUE INDEX uq_legal_entities_default
  ON public.legal_entities (tenant_id)
  WHERE is_default = true;

CREATE INDEX idx_legal_entities_tenant ON public.legal_entities(tenant_id);

-- RLS
ALTER TABLE public.legal_entities ENABLE ROW LEVEL SECURITY;

-- Restrictive auth gate (Deep Defense)
CREATE POLICY "auth_gate_legal_entities"
  ON public.legal_entities AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Tenant isolation
CREATE POLICY "tenant_isolation_legal_entities"
  ON public.legal_entities FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- Updated-at trigger
CREATE TRIGGER set_legal_entities_updated_at
  BEFORE UPDATE ON public.legal_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════
-- 2. Extend branches with legal_entity_id
-- ═══════════════════════════════════════════
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS cost_center_code text;

-- ═══════════════════════════════════════════
-- 3. Extend cost_centers with legal_entity_id + unique constraint
-- ═══════════════════════════════════════════
ALTER TABLE public.cost_centers
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL;

-- Unique code per tenant + legal entity
CREATE UNIQUE INDEX IF NOT EXISTS uq_cost_centers_tenant_entity_code
  ON public.cost_centers (tenant_id, legal_entity_id, code)
  WHERE legal_entity_id IS NOT NULL AND code IS NOT NULL;
