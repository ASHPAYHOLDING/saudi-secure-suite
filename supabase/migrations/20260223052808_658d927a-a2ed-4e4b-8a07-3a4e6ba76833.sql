CREATE OR REPLACE FUNCTION public.emit_journal_finance_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.finance_events (tenant_id, aggregate_type, aggregate_id, event_type, payload_json, created_by)
  VALUES (
    NEW.tenant_id,
    'journal',
    NEW.id,
    'journal_' || NEW.status,
    jsonb_build_object(
      'entry_number', NEW.entry_number,
      'description', NEW.description,
      'total_debit', NEW.total_debit,
      'total_credit', NEW.total_credit,
      'reference_type', COALESCE(NEW.source_type, ''),
      'reference_id', NEW.source_id
    ),
    COALESCE(auth.uid(), NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
  );
  RETURN NEW;
END;
$$;