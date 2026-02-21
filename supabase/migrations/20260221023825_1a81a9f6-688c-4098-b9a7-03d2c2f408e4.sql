
-- Fix search_path on new trigger functions
CREATE OR REPLACE FUNCTION public.trg_validate_journal_line()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.debit < 0 OR NEW.credit < 0 THEN RAISE EXCEPTION 'Debit and credit must be non-negative'; END IF;
  IF NEW.debit > 0 AND NEW.credit > 0 THEN RAISE EXCEPTION 'A journal line cannot have both debit and credit > 0'; END IF;
  IF NEW.debit = 0 AND NEW.credit = 0 THEN RAISE EXCEPTION 'Either debit or credit must be > 0'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_journal_immutability()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
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
