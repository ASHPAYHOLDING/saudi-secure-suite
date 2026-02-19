
-- Drop old function signature (returns tenant_id, document_type, document_id, is_valid)
DROP FUNCTION IF EXISTS public.validate_document_token(text);

-- Recreate: returns only document_type, document_id, is_valid (no tenant_id leak)
CREATE OR REPLACE FUNCTION public.validate_document_token(_token TEXT)
RETURNS TABLE(document_type TEXT, document_id UUID, is_valid BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec RECORD;
  _prefix TEXT;
  _recent_attempts INT;
BEGIN
  _prefix := left(_token, 8);

  -- Rate limit: max 10 attempts per token-prefix per 5 minutes
  SELECT count(*) INTO _recent_attempts
  FROM public.token_access_log
  WHERE token_prefix = _prefix
    AND accessed_at > now() - interval '5 minutes';

  IF _recent_attempts >= 10 THEN
    INSERT INTO public.token_access_log (token_prefix, result)
    VALUES (_prefix, 'rate_limited');
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false;
    RETURN;
  END IF;

  SELECT * INTO _rec
  FROM public.document_access_tokens dat
  WHERE dat.token = _token;

  IF NOT FOUND THEN
    INSERT INTO public.token_access_log (token_prefix, result)
    VALUES (_prefix, 'not_found');
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, false;
    RETURN;
  END IF;

  IF _rec.status != 'active' THEN
    INSERT INTO public.token_access_log (token_id, token_prefix, result)
    VALUES (_rec.id, _prefix, 'revoked');
    RETURN QUERY SELECT _rec.document_type, _rec.document_id, false;
    RETURN;
  END IF;

  IF _rec.expires_at < now() THEN
    INSERT INTO public.token_access_log (token_id, token_prefix, result)
    VALUES (_rec.id, _prefix, 'expired');
    RETURN QUERY SELECT _rec.document_type, _rec.document_id, false;
    RETURN;
  END IF;

  IF _rec.access_count >= _rec.max_access THEN
    INSERT INTO public.token_access_log (token_id, token_prefix, result)
    VALUES (_rec.id, _prefix, 'exhausted');
    RETURN QUERY SELECT _rec.document_type, _rec.document_id, false;
    RETURN;
  END IF;

  UPDATE public.document_access_tokens
  SET access_count = access_count + 1, accessed_at = now()
  WHERE id = _rec.id;

  INSERT INTO public.token_access_log (token_id, token_prefix, result)
  VALUES (_rec.id, _prefix, 'success');

  RETURN QUERY SELECT _rec.document_type, _rec.document_id, true;
END;
$$;
