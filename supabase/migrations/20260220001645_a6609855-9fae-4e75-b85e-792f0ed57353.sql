-- ─── 1. Add missing columns to tenant_settings ───────────────────────────────
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS version   bigint       NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid         NULL;

-- Backfill version=1 for existing rows that have version=1 already (idempotent)
UPDATE public.tenant_settings SET version = 1 WHERE version IS NULL OR version = 0;

-- ─── 2. Index for faster CAS lookups ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_version
  ON public.tenant_settings (tenant_id, version);

-- ─── 3. Atomic compare-and-swap RPC ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_tenant_settings_cas(
  p_tenant_id        text,
  p_patch            jsonb,
  p_expected_version bigint,
  p_column           text DEFAULT 'branding_config'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tid        uuid := p_tenant_id::uuid;
  _uid        uuid := auth.uid();
  _row        record;
  _new_config jsonb;
  _new_version bigint;
  _now        timestamptz := now();
BEGIN
  -- Fetch current row with lock
  SELECT * INTO _row
  FROM public.tenant_settings
  WHERE tenant_id = _tid
  FOR UPDATE;

  -- Row missing: insert with version=1
  IF NOT FOUND THEN
    INSERT INTO public.tenant_settings (tenant_id, branding_config, version, updated_at, updated_by)
    VALUES (_tid, COALESCE(p_patch, '{}'::jsonb), 1, _now, _uid)
    ON CONFLICT (tenant_id) DO UPDATE
      SET branding_config = EXCLUDED.branding_config,
          version = 1,
          updated_at = _now,
          updated_by = _uid;

    RETURN jsonb_build_object(
      'ok', true,
      'new_version', 1,
      'new_config', COALESCE(p_patch, '{}'::jsonb),
      'updated_at', _now
    );
  END IF;

  -- Version mismatch → conflict
  IF _row.version != p_expected_version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'conflict',
      'current_version', _row.version,
      'current_config', _row.branding_config,
      'updated_at', _row.updated_at,
      'updated_by', _row.updated_by
    );
  END IF;

  -- Version matches → merge and update
  _new_config  := COALESCE(_row.branding_config, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb);
  _new_version := _row.version + 1;

  UPDATE public.tenant_settings
  SET branding_config = _new_config,
      version         = _new_version,
      updated_at      = _now,
      updated_by      = _uid
  WHERE tenant_id = _tid;

  RETURN jsonb_build_object(
    'ok', true,
    'new_version', _new_version,
    'new_config', _new_config,
    'updated_at', _now
  );
END;
$$;

-- Revoke public execute, grant to authenticated users only
REVOKE EXECUTE ON FUNCTION public.update_tenant_settings_cas(text, jsonb, bigint, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_tenant_settings_cas(text, jsonb, bigint, text) TO authenticated;
