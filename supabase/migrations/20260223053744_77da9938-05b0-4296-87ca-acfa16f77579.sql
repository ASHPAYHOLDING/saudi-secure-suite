-- Fix get_cash_flow: replace je.legal_entity_id with branch-based lookup
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net_income numeric;
  v_operating jsonb;
  v_financing jsonb;
BEGIN
  SELECT COALESCE(SUM(
    CASE WHEN ca.account_type = 'revenue' THEN jl.credit - jl.debit
         WHEN ca.account_type = 'expense' THEN -(jl.debit - jl.credit)
         ELSE 0 END
  ), 0)
  INTO v_net_income
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.entry_id
  JOIN coa_accounts ca ON ca.id = jl.account_id
  LEFT JOIN branches b ON b.id = je.branch_id
  WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
    AND je.entry_date BETWEEN p_from AND p_to
    AND ca.account_type IN ('revenue', 'expense')
    AND (p_legal_entity_id IS NULL OR b.legal_entity_id = p_legal_entity_id)
    AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
    AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id);

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
    LEFT JOIN branches b ON b.id = je.branch_id
    WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
      AND je.entry_date BETWEEN p_from AND p_to
      AND ca.account_type IN ('asset', 'liability')
      AND ca.code NOT LIKE '1___'
      AND (p_legal_entity_id IS NULL OR b.legal_entity_id = p_legal_entity_id)
      AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
      AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
    GROUP BY ca.id, ca.code, ca.name, ca.name_en, ca.account_type
    HAVING ABS(COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0)) > 0.01
    ORDER BY ca.code
  ) r;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_financing
  FROM (
    SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en,
           COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0) AS amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    JOIN coa_accounts ca ON ca.id = jl.account_id
    LEFT JOIN branches b ON b.id = je.branch_id
    WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
      AND je.entry_date BETWEEN p_from AND p_to
      AND ca.account_type = 'equity'
      AND (p_legal_entity_id IS NULL OR b.legal_entity_id = p_legal_entity_id)
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

-- Fix get_profit_loss: replace je.legal_entity_id with branch-based lookup
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revenue jsonb;
  v_expenses jsonb;
  v_total_revenue numeric;
  v_total_expenses numeric;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_revenue
  FROM (
    SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en,
           COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) AS amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    JOIN coa_accounts ca ON ca.id = jl.account_id
    LEFT JOIN branches b ON b.id = je.branch_id
    WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
      AND je.entry_date BETWEEN p_from AND p_to AND ca.account_type = 'revenue'
      AND (p_legal_entity_id IS NULL OR b.legal_entity_id = p_legal_entity_id)
      AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
      AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
    GROUP BY ca.id, ca.code, ca.name, ca.name_en ORDER BY ca.code
  ) r;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_expenses
  FROM (
    SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en,
           COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    JOIN coa_accounts ca ON ca.id = jl.account_id
    LEFT JOIN branches b ON b.id = je.branch_id
    WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
      AND je.entry_date BETWEEN p_from AND p_to AND ca.account_type = 'expense'
      AND (p_legal_entity_id IS NULL OR b.legal_entity_id = p_legal_entity_id)
      AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
      AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
    GROUP BY ca.id, ca.code, ca.name, ca.name_en ORDER BY ca.code
  ) r;

  v_total_revenue := COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_revenue) item), 0);
  v_total_expenses := COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_expenses) item), 0);

  RETURN jsonb_build_object(
    'revenue', v_revenue,
    'expenses', v_expenses,
    'total_revenue', v_total_revenue,
    'total_expenses', v_total_expenses,
    'net_profit', v_total_revenue - v_total_expenses,
    'gross_margin', CASE WHEN v_total_revenue > 0 THEN ROUND(((v_total_revenue - v_total_expenses) / v_total_revenue * 100)::numeric, 2) ELSE 0 END
  );
END;
$$;

-- Fix get_balance_sheet: replace je.legal_entity_id with branch-based lookup
CREATE OR REPLACE FUNCTION public.get_balance_sheet(
  p_tenant_id uuid,
  p_as_of date,
  p_legal_entity_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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
  SELECT jsonb_build_object(
    'assets', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT ca.id AS account_id, ca.code, ca.name, ca.name_en,
               COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS amount
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        JOIN coa_accounts ca ON ca.id = jl.account_id
        LEFT JOIN branches b ON b.id = je.branch_id
        WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
          AND je.entry_date <= p_as_of AND ca.account_type = 'asset'
          AND (p_legal_entity_id IS NULL OR b.legal_entity_id = p_legal_entity_id)
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
        LEFT JOIN branches b ON b.id = je.branch_id
        WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
          AND je.entry_date <= p_as_of AND ca.account_type = 'liability'
          AND (p_legal_entity_id IS NULL OR b.legal_entity_id = p_legal_entity_id)
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
        LEFT JOIN branches b ON b.id = je.branch_id
        WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
          AND je.entry_date <= p_as_of AND ca.account_type = 'equity'
          AND (p_legal_entity_id IS NULL OR b.legal_entity_id = p_legal_entity_id)
          AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
          AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id)
        GROUP BY ca.id, ca.code, ca.name, ca.name_en ORDER BY ca.code
      ) r
    ), '[]'::jsonb)
  ) INTO v_result;

  SELECT COALESCE(SUM(
    CASE WHEN ca.account_type = 'revenue' THEN jl.credit - jl.debit
         WHEN ca.account_type = 'expense' THEN -(jl.debit - jl.credit)
         ELSE 0 END
  ), 0)
  INTO v_retained_earnings
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.entry_id
  JOIN coa_accounts ca ON ca.id = jl.account_id
  LEFT JOIN branches b ON b.id = je.branch_id
  WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
    AND je.entry_date <= p_as_of AND ca.account_type IN ('revenue', 'expense')
    AND (p_legal_entity_id IS NULL OR b.legal_entity_id = p_legal_entity_id)
    AND (p_branch_id IS NULL OR je.branch_id = p_branch_id)
    AND (p_cost_center_id IS NULL OR je.cost_center_id = p_cost_center_id);

  v_total_assets := COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_result->'assets') item), 0);
  v_total_liabilities := COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_result->'liabilities') item), 0);
  v_total_equity := COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(v_result->'equity') item), 0) + v_retained_earnings;

  RETURN v_result || jsonb_build_object(
    'total_assets', v_total_assets,
    'total_liabilities', v_total_liabilities,
    'total_equity', v_total_equity,
    'retained_earnings', v_retained_earnings,
    'total_liabilities_equity', v_total_liabilities + v_total_equity,
    'is_balanced', ABS(v_total_assets - (v_total_liabilities + v_total_equity)) < 0.01
  );
END;
$$;