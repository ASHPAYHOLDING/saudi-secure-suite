
-- ============================================================
-- 1. Usage summary function (returns current usage + limits)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tenant_usage_summary(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub RECORD;
  _plan RECORD;
  _user_count integer;
  _invoice_count integer;
  _storage_bytes bigint;
  _storage_gb numeric;
  _result jsonb;
BEGIN
  -- Get active subscription + plan
  SELECT s.*, sp.max_users, sp.max_invoices, sp.max_storage_gb, sp.slug AS plan_slug, s.status AS sub_status
  INTO _sub
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial','past_due')
  ORDER BY s.created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_subscription');
  END IF;

  -- Count users
  SELECT count(*) INTO _user_count
  FROM public.tenant_members WHERE tenant_id = _tenant_id;

  -- Count invoices this month
  SELECT count(*) INTO _invoice_count
  FROM public.invoices
  WHERE tenant_id = _tenant_id
    AND created_at >= date_trunc('month', now())
    AND created_at < date_trunc('month', now()) + interval '1 month';

  -- Storage: sum file sizes from storage.objects for this tenant's buckets
  -- We approximate by counting files in tenant folder
  SELECT COALESCE(sum(o.metadata->>'size')::bigint, 0) INTO _storage_bytes
  FROM storage.objects o
  WHERE o.name LIKE _tenant_id::text || '/%';

  _storage_gb := ROUND(_storage_bytes / (1024.0 * 1024 * 1024), 2);

  _result := jsonb_build_object(
    'is_trial', _sub.sub_status = 'trial',
    'plan_slug', _sub.plan_slug,
    'users', jsonb_build_object(
      'current', _user_count,
      'limit', _sub.max_users,
      'unlimited', _sub.max_users IS NULL
    ),
    'invoices_monthly', jsonb_build_object(
      'current', _invoice_count,
      'limit', _sub.max_invoices,
      'unlimited', _sub.max_invoices IS NULL
    ),
    'storage_gb', jsonb_build_object(
      'current', _storage_gb,
      'limit', _sub.max_storage_gb,
      'unlimited', _sub.max_storage_gb IS NULL
    )
  );

  RETURN _result;
END;
$$;

-- ============================================================
-- 2. Enforce user limit on tenant_members INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_user_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub RECORD;
  _current_count integer;
BEGIN
  -- Get subscription
  SELECT s.status, sp.max_users, sp.slug
  INTO _sub
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = NEW.tenant_id AND s.status IN ('active','trial','past_due')
  ORDER BY s.created_at DESC LIMIT 1;

  -- Trial bypasses all limits
  IF _sub.status = 'trial' THEN
    RETURN NEW;
  END IF;

  -- No limit defined = unlimited
  IF _sub.max_users IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count current users
  SELECT count(*) INTO _current_count
  FROM public.tenant_members WHERE tenant_id = NEW.tenant_id;

  IF _current_count >= _sub.max_users THEN
    RAISE EXCEPTION 'تم الوصول للحد الأقصى من المستخدمين (% / %). يرجى ترقية الباقة للإضافة.', _current_count, _sub.max_users;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists then create trigger
DROP TRIGGER IF EXISTS trg_enforce_user_limit ON public.tenant_members;
CREATE TRIGGER trg_enforce_user_limit
BEFORE INSERT ON public.tenant_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_limit();

-- ============================================================
-- 3. Enforce monthly invoice limit on invoices INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_invoice_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub RECORD;
  _current_count integer;
BEGIN
  -- Get subscription
  SELECT s.status, sp.max_invoices, sp.slug
  INTO _sub
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = NEW.tenant_id AND s.status IN ('active','trial','past_due')
  ORDER BY s.created_at DESC LIMIT 1;

  -- Trial bypasses all limits
  IF _sub.status = 'trial' THEN
    RETURN NEW;
  END IF;

  -- No limit = unlimited
  IF _sub.max_invoices IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count invoices this month
  SELECT count(*) INTO _current_count
  FROM public.invoices
  WHERE tenant_id = NEW.tenant_id
    AND created_at >= date_trunc('month', now())
    AND created_at < date_trunc('month', now()) + interval '1 month';

  IF _current_count >= _sub.max_invoices THEN
    RAISE EXCEPTION 'تم الوصول للحد الأقصى من الفواتير الشهرية (% / %). يرجى ترقية الباقة.', _current_count, _sub.max_invoices;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_limit ON public.invoices;
CREATE TRIGGER trg_enforce_invoice_limit
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invoice_limit();

-- ============================================================
-- 4. Enforce storage limit (called before upload via RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_storage_limit(_tenant_id uuid, _file_size_bytes bigint DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub RECORD;
  _used_bytes bigint;
  _used_gb numeric;
  _limit_bytes bigint;
BEGIN
  SELECT s.status, sp.max_storage_gb
  INTO _sub
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial','past_due')
  ORDER BY s.created_at DESC LIMIT 1;

  -- Trial bypasses
  IF _sub.status = 'trial' THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'trial');
  END IF;

  -- Unlimited
  IF _sub.max_storage_gb IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
  END IF;

  -- Calculate used storage
  SELECT COALESCE(sum((o.metadata->>'size')::bigint), 0) INTO _used_bytes
  FROM storage.objects o
  WHERE o.name LIKE _tenant_id::text || '/%';

  _used_gb := (_used_bytes + _file_size_bytes) / (1024.0 * 1024 * 1024);
  _limit_bytes := _sub.max_storage_gb::bigint * 1024 * 1024 * 1024;

  IF (_used_bytes + _file_size_bytes) > _limit_bytes THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'storage_limit_exceeded',
      'used_gb', ROUND(_used_bytes / (1024.0 * 1024 * 1024), 2),
      'limit_gb', _sub.max_storage_gb,
      'message', 'تم تجاوز حد التخزين المسموح (' || _sub.max_storage_gb || ' GB). يرجى ترقية الباقة.'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'used_gb', ROUND(_used_bytes / (1024.0 * 1024 * 1024), 2), 'limit_gb', _sub.max_storage_gb);
END;
$$;
