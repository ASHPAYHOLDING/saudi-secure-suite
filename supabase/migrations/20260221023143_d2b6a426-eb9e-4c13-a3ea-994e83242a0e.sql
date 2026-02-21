
-- ═══════════════════════════════════════════
-- Account type enum
-- ═══════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','revenue','expense');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════
-- chart_of_accounts
-- ═══════════════════════════════════════════
CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  name text NOT NULL,
  name_en text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active chart per legal entity per tenant
CREATE UNIQUE INDEX uq_coa_active_per_entity
  ON public.chart_of_accounts (tenant_id, legal_entity_id)
  WHERE is_active = true;

CREATE INDEX idx_coa_tenant ON public.chart_of_accounts(tenant_id);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_gate_coa"
  ON public.chart_of_accounts AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tenant_isolation_coa"
  ON public.chart_of_accounts FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE TRIGGER set_coa_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════
-- coa_accounts
-- ═══════════════════════════════════════════
CREATE TABLE public.coa_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chart_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  name_en text,
  account_type public.account_type NOT NULL DEFAULT 'expense',
  parent_id uuid REFERENCES public.coa_accounts(id) ON DELETE SET NULL,
  is_postable boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_coa_accounts_code
  ON public.coa_accounts (tenant_id, chart_id, code);

CREATE INDEX idx_coa_accounts_chart ON public.coa_accounts(chart_id);
CREATE INDEX idx_coa_accounts_parent ON public.coa_accounts(parent_id);

ALTER TABLE public.coa_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_gate_coa_accounts"
  ON public.coa_accounts AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tenant_isolation_coa_accounts"
  ON public.coa_accounts FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE TRIGGER set_coa_accounts_updated_at
  BEFORE UPDATE ON public.coa_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════
-- Clone chart function (version + 1)
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.clone_chart_of_accounts(
  p_chart_id uuid,
  p_new_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source RECORD;
  v_new_chart_id uuid;
  v_id_map jsonb := '{}'::jsonb;
  v_acc RECORD;
  v_new_id uuid;
BEGIN
  -- Get source chart
  SELECT * INTO v_source FROM chart_of_accounts WHERE id = p_chart_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chart not found'; END IF;

  -- Create new chart with incremented version
  INSERT INTO chart_of_accounts (tenant_id, legal_entity_id, version, name, name_en, is_active)
  VALUES (
    v_source.tenant_id,
    v_source.legal_entity_id,
    v_source.version + 1,
    COALESCE(p_new_name, v_source.name || ' v' || (v_source.version + 1)::text),
    v_source.name_en,
    false  -- new clone starts inactive
  )
  RETURNING id INTO v_new_chart_id;

  -- Clone accounts (parents first via sort_order)
  -- First pass: insert all without parent_id
  FOR v_acc IN
    SELECT * FROM coa_accounts WHERE chart_id = p_chart_id ORDER BY sort_order
  LOOP
    v_new_id := gen_random_uuid();
    v_id_map := v_id_map || jsonb_build_object(v_acc.id::text, v_new_id::text);

    INSERT INTO coa_accounts (id, tenant_id, chart_id, code, name, name_en, account_type, is_postable, sort_order)
    VALUES (v_new_id, v_source.tenant_id, v_new_chart_id, v_acc.code, v_acc.name, v_acc.name_en, v_acc.account_type, v_acc.is_postable, v_acc.sort_order);
  END LOOP;

  -- Second pass: set parent_id references
  FOR v_acc IN
    SELECT * FROM coa_accounts WHERE chart_id = p_chart_id AND parent_id IS NOT NULL
  LOOP
    UPDATE coa_accounts
    SET parent_id = (v_id_map ->> v_acc.parent_id::text)::uuid
    WHERE id = (v_id_map ->> v_acc.id::text)::uuid;
  END LOOP;

  RETURN v_new_chart_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clone_chart_of_accounts(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clone_chart_of_accounts(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clone_chart_of_accounts(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.clone_chart_of_accounts(uuid, text) TO service_role;
