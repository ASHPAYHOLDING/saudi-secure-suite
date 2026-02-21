
-- Fix: drop pre-existing trigger then re-create
DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON public.journal_entries;

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure remaining objects exist (idempotent for items already created above)

-- journal_lines table (IF NOT EXISTS handles re-run)
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.coa_accounts(id),
  description text,
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'SAR',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies (use IF NOT EXISTS pattern via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'journal_lines_tenant_isolation' AND tablename = 'journal_lines') THEN
    CREATE POLICY "journal_lines_tenant_isolation" ON public.journal_lines
      AS RESTRICTIVE FOR ALL
      USING (tenant_id = (SELECT (auth.jwt()->'app_metadata'->>'tenant_id')::uuid));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'journal_lines_select' AND tablename = 'journal_lines') THEN
    CREATE POLICY "journal_lines_select" ON public.journal_lines FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'journal_lines_insert' AND tablename = 'journal_lines') THEN
    CREATE POLICY "journal_lines_insert" ON public.journal_lines FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'journal_lines_update' AND tablename = 'journal_lines') THEN
    CREATE POLICY "journal_lines_update" ON public.journal_lines FOR UPDATE
      USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = entry_id AND je.status = 'draft'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'journal_lines_delete' AND tablename = 'journal_lines') THEN
    CREATE POLICY "journal_lines_delete" ON public.journal_lines FOR DELETE
      USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = entry_id AND je.status = 'draft'));
  END IF;
END $$;

-- Validation trigger
CREATE OR REPLACE FUNCTION public.trg_validate_journal_line()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.debit < 0 OR NEW.credit < 0 THEN RAISE EXCEPTION 'Debit and credit must be non-negative'; END IF;
  IF NEW.debit > 0 AND NEW.credit > 0 THEN RAISE EXCEPTION 'A journal line cannot have both debit and credit > 0'; END IF;
  IF NEW.debit = 0 AND NEW.credit = 0 THEN RAISE EXCEPTION 'Either debit or credit must be > 0'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_journal_line ON public.journal_lines;
CREATE TRIGGER validate_journal_line
  BEFORE INSERT OR UPDATE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_journal_line();

-- Immutability trigger
CREATE OR REPLACE FUNCTION public.trg_journal_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted','reversed') THEN RAISE EXCEPTION 'Cannot delete a posted or reversed journal entry'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('posted','reversed') THEN
      IF NEW.status = 'reversed' AND OLD.status = 'posted' AND NEW.tenant_id = OLD.tenant_id AND NEW.id = OLD.id THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Cannot modify a posted or reversed journal entry';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journal_entry_immutability ON public.journal_entries;
CREATE TRIGGER journal_entry_immutability
  BEFORE UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_journal_immutability();

-- Posting RPC
CREATE OR REPLACE FUNCTION public.post_journal_entry(p_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry journal_entries%ROWTYPE;
  v_total_debit numeric; v_total_credit numeric; v_bad_accounts int;
BEGIN
  SELECT * INTO v_entry FROM journal_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
  IF v_entry.status <> 'draft' THEN RAISE EXCEPTION 'Only draft entries can be posted (current: %)', v_entry.status; END IF;

  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO v_total_debit, v_total_credit FROM journal_lines WHERE entry_id = p_entry_id;
  IF v_total_debit <> v_total_credit THEN RAISE EXCEPTION 'Entry is not balanced: debit=% credit=%', v_total_debit, v_total_credit; END IF;
  IF v_total_debit = 0 THEN RAISE EXCEPTION 'Entry has no lines'; END IF;

  SELECT COUNT(*) INTO v_bad_accounts FROM journal_lines jl JOIN coa_accounts ca ON ca.id = jl.account_id WHERE jl.entry_id = p_entry_id AND ca.is_postable = false;
  IF v_bad_accounts > 0 THEN RAISE EXCEPTION '% account(s) are not postable', v_bad_accounts; END IF;

  UPDATE journal_entries SET status = 'posted', posted_at = now(), updated_at = now() WHERE id = p_entry_id;

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
  VALUES (v_entry.tenant_id, COALESCE(auth.uid(), v_entry.created_by), 'journal_posted', 'journal_entry', p_entry_id::text, v_entry.reference);

  RETURN jsonb_build_object('success', true, 'posted_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.post_journal_entry(uuid) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(uuid) TO service_role;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_status ON public.journal_entries (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries (tenant_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines (entry_id);
