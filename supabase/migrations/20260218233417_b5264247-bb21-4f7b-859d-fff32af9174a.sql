
-- Custom Report Builder configs (presets)
CREATE TABLE public.custom_report_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  view_name TEXT NOT NULL,
  selected_columns TEXT[] NOT NULL DEFAULT '{}',
  filters JSONB NOT NULL DEFAULT '{}',
  group_by TEXT[] NOT NULL DEFAULT '{}',
  sort_by TEXT,
  sort_direction TEXT DEFAULT 'asc',
  period_from DATE,
  period_to DATE,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_report_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own configs" ON public.custom_report_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared configs in tenant" ON public.custom_report_configs
  FOR SELECT USING (
    is_shared = true AND tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own configs" ON public.custom_report_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own configs" ON public.custom_report_configs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own configs" ON public.custom_report_configs
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_custom_report_configs_updated_at
  BEFORE UPDATE ON public.custom_report_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Safe RPC to query analytics views with tenant isolation
CREATE OR REPLACE FUNCTION public.query_analytics_view(
  _tenant_id UUID,
  _view_name TEXT,
  _columns TEXT[] DEFAULT NULL,
  _group_by TEXT[] DEFAULT NULL,
  _period_from DATE DEFAULT NULL,
  _period_to DATE DEFAULT NULL,
  _branch_id UUID DEFAULT NULL,
  _sort_by TEXT DEFAULT NULL,
  _sort_direction TEXT DEFAULT 'asc',
  _limit INT DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_views TEXT[] := ARRAY[
    'ar_aging_view','ap_aging_view','balance_sheet_view','cashflow_view',
    'expense_summary_view','profit_loss_view','revenue_summary_view',
    'vat_summary_view'
  ];
  view_columns TEXT[];
  safe_columns TEXT[] := '{}';
  safe_group TEXT[] := '{}';
  col TEXT;
  query TEXT;
  result JSONB;
BEGIN
  -- Validate view name against whitelist
  IF NOT (_view_name = ANY(allowed_views)) THEN
    RAISE EXCEPTION 'Invalid view name: %', _view_name;
  END IF;

  -- Get actual columns of the view
  SELECT array_agg(column_name::TEXT)
  INTO view_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = _view_name;

  -- Validate requested columns
  IF _columns IS NOT NULL AND array_length(_columns, 1) > 0 THEN
    FOREACH col IN ARRAY _columns LOOP
      IF col = ANY(view_columns) AND col != 'tenant_id' THEN
        safe_columns := safe_columns || col;
      END IF;
    END LOOP;
  ELSE
    -- Use all columns except tenant_id
    FOREACH col IN ARRAY view_columns LOOP
      IF col != 'tenant_id' THEN
        safe_columns := safe_columns || col;
      END IF;
    END LOOP;
  END IF;

  IF array_length(safe_columns, 1) IS NULL THEN
    RAISE EXCEPTION 'No valid columns selected';
  END IF;

  -- Validate group_by columns
  IF _group_by IS NOT NULL AND array_length(_group_by, 1) > 0 THEN
    FOREACH col IN ARRAY _group_by LOOP
      IF col = ANY(safe_columns) THEN
        safe_group := safe_group || col;
      END IF;
    END LOOP;
  END IF;

  -- Build query
  IF array_length(safe_group, 1) > 0 THEN
    -- Grouped query: group columns + SUM of numeric columns
    DECLARE
      select_parts TEXT[] := '{}';
      num_cols TEXT[] := '{}';
      c TEXT;
      col_type TEXT;
    BEGIN
      -- Add group columns
      FOREACH c IN ARRAY safe_group LOOP
        select_parts := select_parts || quote_ident(c);
      END LOOP;
      -- Add SUM for numeric columns not in group
      FOREACH c IN ARRAY safe_columns LOOP
        IF NOT (c = ANY(safe_group)) THEN
          SELECT data_type INTO col_type
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = _view_name AND column_name = c;
          IF col_type IN ('numeric','integer','bigint','double precision','real') THEN
            select_parts := select_parts || format('SUM(%I) AS %I', c, c);
          END IF;
        END IF;
      END LOOP;
      query := format('SELECT %s FROM public.%I WHERE tenant_id = $1',
        array_to_string(select_parts, ', '), _view_name);
    END;
  ELSE
    query := format('SELECT %s FROM public.%I WHERE tenant_id = $1',
      (SELECT string_agg(quote_ident(c), ', ') FROM unnest(safe_columns) AS c),
      _view_name);
  END IF;

  -- Period filter
  IF _period_from IS NOT NULL THEN
    IF 'period' = ANY(view_columns) THEN
      query := query || format(' AND period >= %L', _period_from);
    ELSIF 'due_date' = ANY(view_columns) THEN
      query := query || format(' AND due_date >= %L', _period_from);
    END IF;
  END IF;
  IF _period_to IS NOT NULL THEN
    IF 'period' = ANY(view_columns) THEN
      query := query || format(' AND period <= %L', _period_to);
    ELSIF 'due_date' = ANY(view_columns) THEN
      query := query || format(' AND due_date <= %L', _period_to);
    END IF;
  END IF;

  -- Branch filter
  IF _branch_id IS NOT NULL AND 'branch_id' = ANY(view_columns) THEN
    query := query || format(' AND branch_id = %L', _branch_id);
  END IF;

  -- Group by
  IF array_length(safe_group, 1) > 0 THEN
    query := query || ' GROUP BY ' || (SELECT string_agg(quote_ident(c), ', ') FROM unnest(safe_group) AS c);
  END IF;

  -- Sort
  IF _sort_by IS NOT NULL AND _sort_by = ANY(safe_columns) THEN
    query := query || format(' ORDER BY %I %s', _sort_by,
      CASE WHEN _sort_direction = 'desc' THEN 'DESC' ELSE 'ASC' END);
  END IF;

  -- Limit
  query := query || format(' LIMIT %s', LEAST(_limit, 5000));

  -- Execute
  EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', query)
  USING _tenant_id
  INTO result;

  RETURN result;
END;
$$;
