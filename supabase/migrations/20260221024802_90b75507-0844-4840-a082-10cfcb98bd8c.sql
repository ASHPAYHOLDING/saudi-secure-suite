
-- Phase 2.5: Financial Statement RPCs

-- 1. Profit & Loss: revenue - expense lines from posted journals
CREATE OR REPLACE FUNCTION public.get_profit_loss(
  p_tenant_id uuid,
  p_from date,
  p_to date,
  p_legal_entity_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'revenue', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en, ca.account_type,
               COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) AS amount
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        JOIN coa_accounts ca ON ca.id = jl.account_id
        WHERE je.tenant_id = p_tenant_id
          AND je.status = 'posted'
          AND je.entry_date BETWEEN p_from AND p_to
          AND ca.account_type = 'revenue'
          AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
          AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
          AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
        GROUP BY ca.id, ca.code, ca.name, ca.name_en, ca.account_type
        ORDER BY ca.code
      ) r
    ), '[]'::jsonb),
    'expenses', COALESCE((
      SELECT jsonb_agg(row_to_json(e))
      FROM (
        SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en, ca.account_type,
               COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS amount
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        JOIN coa_accounts ca ON ca.id = jl.account_id
        WHERE je.tenant_id = p_tenant_id
          AND je.status = 'posted'
          AND je.entry_date BETWEEN p_from AND p_to
          AND ca.account_type = 'expense'
          AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
          AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
          AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
        GROUP BY ca.id, ca.code, ca.name, ca.name_en, ca.account_type
        ORDER BY ca.code
      ) e
    ), '[]'::jsonb)
  ) INTO v_result;

  -- Add totals
  v_result := v_result || jsonb_build_object(
    'total_revenue', COALESCE((
      SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_result->'revenue') item
    ), 0),
    'total_expenses', COALESCE((
      SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_result->'expenses') item
    ), 0)
  );
  v_result := v_result || jsonb_build_object(
    'net_income', (v_result->>'total_revenue')::numeric - (v_result->>'total_expenses')::numeric
  );

  RETURN v_result;
END;
$$;

-- 2. Balance Sheet: assets, liabilities, equity as of a date
CREATE OR REPLACE FUNCTION public.get_balance_sheet(
  p_tenant_id uuid,
  p_as_of date,
  p_legal_entity_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_total_assets numeric;
  v_total_liabilities numeric;
  v_total_equity numeric;
  v_retained_earnings numeric;
BEGIN
  -- Assets (debit-normal)
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_result
  FROM (SELECT 'placeholder'::text) x;

  SELECT jsonb_build_object(
    'assets', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en,
               COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS amount
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        JOIN coa_accounts ca ON ca.id = jl.account_id
        WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
          AND je.entry_date <= p_as_of AND ca.account_type = 'asset'
          AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
          AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
          AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
        GROUP BY ca.id, ca.code, ca.name, ca.name_en ORDER BY ca.code
      ) r
    ), '[]'::jsonb),
    'liabilities', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en,
               COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) AS amount
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        JOIN coa_accounts ca ON ca.id = jl.account_id
        WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
          AND je.entry_date <= p_as_of AND ca.account_type = 'liability'
          AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
          AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
          AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
        GROUP BY ca.id, ca.code, ca.name, ca.name_en ORDER BY ca.code
      ) r
    ), '[]'::jsonb),
    'equity', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en,
               COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) AS amount
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        JOIN coa_accounts ca ON ca.id = jl.account_id
        WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
          AND je.entry_date <= p_as_of AND ca.account_type = 'equity'
          AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
          AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
          AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
        GROUP BY ca.id, ca.code, ca.name, ca.name_en ORDER BY ca.code
      ) r
    ), '[]'::jsonb)
  ) INTO v_result;

  -- Calculate retained earnings (revenue - expense up to date)
  SELECT COALESCE(SUM(CASE WHEN ca.account_type = 'revenue' THEN jl.credit - jl.debit ELSE jl.debit - jl.credit END), 0) * -1
  INTO v_retained_earnings
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.entry_id
  JOIN coa_accounts ca ON ca.id = jl.account_id
  WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
    AND je.entry_date <= p_as_of AND ca.account_type IN ('revenue', 'expense')
    AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
    AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
    AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id);

  -- Fix retained earnings sign: revenue - expense
  SELECT COALESCE(SUM(
    CASE WHEN ca.account_type = 'revenue' THEN jl.credit - jl.debit
         WHEN ca.account_type = 'expense' THEN -(jl.debit - jl.credit)
         ELSE 0 END
  ), 0)
  INTO v_retained_earnings
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.entry_id
  JOIN coa_accounts ca ON ca.id = jl.account_id
  WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
    AND je.entry_date <= p_as_of AND ca.account_type IN ('revenue', 'expense')
    AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
    AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
    AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id);

  -- Totals
  v_total_assets := COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_result->'assets') item), 0);
  v_total_liabilities := COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_result->'liabilities') item), 0);
  v_total_equity := COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_result->'equity') item), 0) + v_retained_earnings;

  v_result := v_result || jsonb_build_object(
    'total_assets', v_total_assets,
    'total_liabilities', v_total_liabilities,
    'total_equity', v_total_equity,
    'retained_earnings', v_retained_earnings,
    'is_balanced', v_total_assets = (v_total_liabilities + v_total_equity)
  );

  RETURN v_result;
END;
$$;

-- 3. Cash Flow (basic indirect method)
CREATE OR REPLACE FUNCTION public.get_cash_flow(
  p_tenant_id uuid,
  p_from date,
  p_to date,
  p_legal_entity_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net_income numeric;
  v_operating jsonb;
  v_investing jsonb;
  v_financing jsonb;
BEGIN
  -- Net income from P&L
  SELECT COALESCE(SUM(
    CASE WHEN ca.account_type = 'revenue' THEN jl.credit - jl.debit
         WHEN ca.account_type = 'expense' THEN -(jl.debit - jl.credit)
         ELSE 0 END
  ), 0)
  INTO v_net_income
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.entry_id
  JOIN coa_accounts ca ON ca.id = jl.account_id
  WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
    AND je.entry_date BETWEEN p_from AND p_to
    AND ca.account_type IN ('revenue', 'expense')
    AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
    AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
    AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id);

  -- Operating: changes in current assets & current liabilities (simplified — all asset/liability changes)
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_operating
  FROM (
    SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en, ca.account_type,
           CASE WHEN ca.account_type = 'asset'
                THEN -(COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0))
                ELSE COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0)
           END AS amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    JOIN coa_accounts ca ON ca.id = jl.account_id
    WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
      AND je.entry_date BETWEEN p_from AND p_to
      AND ca.account_type IN ('asset', 'liability')
      AND ca.code NOT LIKE '1___'  -- Exclude cash accounts (typically 1xxx top-level)
      AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
      AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
      AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
    GROUP BY ca.id, ca.code, ca.name, ca.name_en, ca.account_type
    HAVING ABS(COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0)) > 0.01
    ORDER BY ca.code
  ) r;

  -- Equity movements (financing)
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_financing
  FROM (
    SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en,
           COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0) AS amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    JOIN coa_accounts ca ON ca.id = jl.account_id
    WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
      AND je.entry_date BETWEEN p_from AND p_to
      AND ca.account_type = 'equity'
      AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
      AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
      AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
    GROUP BY ca.id, ca.code, ca.name, ca.name_en
    HAVING ABS(COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0)) > 0.01
    ORDER BY ca.code
  ) r;

  RETURN jsonb_build_object(
    'net_income', v_net_income,
    'operating_adjustments', v_operating,
    'financing_activities', v_financing,
    'total_operating', v_net_income + COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_operating) item), 0),
    'total_financing', COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_financing) item), 0),
    'net_change_in_cash', v_net_income
      + COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_operating) item), 0)
      + COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_financing) item), 0)
  );
END;
$$;

-- 4. Drill-down: get journal lines for a specific account within a date range
CREATE OR REPLACE FUNCTION public.get_account_drilldown(
  p_tenant_id uuid,
  p_account_id uuid,
  p_from date,
  p_to date,
  p_legal_entity_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT jl.id AS line_id, jl.description, jl.debit, jl.credit,
             je.id AS entry_id, je.reference, je.entry_date, je.memo
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.entry_id
      WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
        AND jl.account_id = p_account_id
        AND je.entry_date BETWEEN p_from AND p_to
        AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
        AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
        AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
      ORDER BY je.entry_date, je.created_at
      LIMIT 500
    ) r
  ), '[]'::jsonb);
END;
$$;

-- 5. Security: service_role only
REVOKE EXECUTE ON FUNCTION public.get_profit_loss FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profit_loss TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_balance_sheet FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_cash_flow FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_flow TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_account_drilldown FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_drilldown TO service_role;
