
-- =====================================================
-- Phase 2: Permission Seeding + Verification
-- Idempotent seed of financial permissions per role
-- + verify_permissions_seed() RPC
-- =====================================================

-- Step 1: Ensure permission_definitions exist for all keys
INSERT INTO public.permission_definitions (key, category, name_ar, name_en, sort_order)
VALUES
  ('invoices.view',        'invoices',        'عرض الفواتير',        'View Invoices',        10),
  ('customers.view',       'customers',       'عرض العملاء',         'View Customers',       10),
  ('customers.edit',       'customers',       'تعديل العملاء',       'Edit Customers',       20),
  ('suppliers.view',       'suppliers',       'عرض الموردين',        'View Suppliers',       10),
  ('expenses.view',        'expenses',        'عرض المصروفات',       'View Expenses',        10),
  ('journal_entries.view', 'journal_entries', 'عرض القيود اليومية',  'View Journal Entries', 10),
  ('wallet.view',          'wallet',          'عرض المحفظة',         'View Wallet',          10)
ON CONFLICT (key) DO NOTHING;

-- Step 2: Define the permission map
-- Owner   : all 7 keys (has_permission already grants owner all, but seed anyway)
-- Admin   : all 7 keys (acts as finance admin)
-- Accountant: all 7 keys
-- Manager : invoices.view, expenses.view, customers.view, customers.edit
-- HR      : none of these financial keys
-- Member  : none of these financial keys

-- Step 3: Remove financial permissions from roles that should NOT have them
-- Remove from Member
DELETE FROM public.role_permissions rp
USING public.custom_roles cr
WHERE rp.role_id = cr.id
  AND rp.tenant_id = cr.tenant_id
  AND cr.base_role = 'member'
  AND rp.permission_key IN (
    'invoices.view','customers.view','customers.edit','suppliers.view',
    'expenses.view','journal_entries.view','wallet.view'
  );

-- Remove financial perms from HR (HR should only have HR-specific perms)
DELETE FROM public.role_permissions rp
USING public.custom_roles cr
WHERE rp.role_id = cr.id
  AND rp.tenant_id = cr.tenant_id
  AND cr.base_role = 'hr'
  AND rp.permission_key IN (
    'invoices.view','customers.edit','suppliers.view',
    'expenses.view','journal_entries.view','wallet.view'
  );
-- Note: HR keeps customers.view if it exists (for cross-ref), let's remove it too per spec
DELETE FROM public.role_permissions rp
USING public.custom_roles cr
WHERE rp.role_id = cr.id
  AND rp.tenant_id = cr.tenant_id
  AND cr.base_role = 'hr'
  AND rp.permission_key = 'customers.view';

-- Remove journal_entries.view and wallet.view from Manager (per spec)
DELETE FROM public.role_permissions rp
USING public.custom_roles cr
WHERE rp.role_id = cr.id
  AND rp.tenant_id = cr.tenant_id
  AND cr.base_role = 'manager'
  AND rp.permission_key IN ('journal_entries.view','wallet.view');

-- Step 4: Seed the correct permissions (idempotent via ON CONFLICT)

-- Owner: all 7
INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
SELECT cr.tenant_id, cr.id, pk.key
FROM public.custom_roles cr
CROSS JOIN (
  VALUES ('invoices.view'),('customers.view'),('customers.edit'),
         ('suppliers.view'),('expenses.view'),('journal_entries.view'),('wallet.view')
) AS pk(key)
WHERE cr.base_role = 'owner'
ON CONFLICT (tenant_id, role_id, permission_key) DO NOTHING;

-- Admin: all 7
INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
SELECT cr.tenant_id, cr.id, pk.key
FROM public.custom_roles cr
CROSS JOIN (
  VALUES ('invoices.view'),('customers.view'),('customers.edit'),
         ('suppliers.view'),('expenses.view'),('journal_entries.view'),('wallet.view')
) AS pk(key)
WHERE cr.base_role = 'admin'
ON CONFLICT (tenant_id, role_id, permission_key) DO NOTHING;

-- Accountant: all 7
INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
SELECT cr.tenant_id, cr.id, pk.key
FROM public.custom_roles cr
CROSS JOIN (
  VALUES ('invoices.view'),('customers.view'),('customers.edit'),
         ('suppliers.view'),('expenses.view'),('journal_entries.view'),('wallet.view')
) AS pk(key)
WHERE cr.base_role = 'accountant'
ON CONFLICT (tenant_id, role_id, permission_key) DO NOTHING;

-- Manager: invoices.view, expenses.view, customers.view, customers.edit (no journal/wallet)
INSERT INTO public.role_permissions (tenant_id, role_id, permission_key)
SELECT cr.tenant_id, cr.id, pk.key
FROM public.custom_roles cr
CROSS JOIN (
  VALUES ('invoices.view'),('customers.view'),('customers.edit'),('expenses.view')
) AS pk(key)
WHERE cr.base_role = 'manager'
ON CONFLICT (tenant_id, role_id, permission_key) DO NOTHING;

-- HR: no financial permissions (already cleaned above)
-- Member: no financial permissions (already cleaned above)

-- Step 5: Create verification RPC
CREATE OR REPLACE FUNCTION public.verify_permissions_seed()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  role_summary jsonb;
  unlinked_perms jsonb;
  simulation jsonb;
BEGIN
  -- 1) Role summary: for each base_role, count of the 7 financial permission keys
  SELECT jsonb_agg(row_to_json(t)::jsonb)
  INTO role_summary
  FROM (
    SELECT
      cr.base_role,
      COUNT(DISTINCT rp.permission_key) AS financial_perm_count,
      array_agg(DISTINCT rp.permission_key ORDER BY rp.permission_key) AS permissions
    FROM public.custom_roles cr
    LEFT JOIN public.role_permissions rp
      ON rp.role_id = cr.id AND rp.tenant_id = cr.tenant_id
      AND rp.permission_key IN (
        'invoices.view','customers.view','customers.edit','suppliers.view',
        'expenses.view','journal_entries.view','wallet.view'
      )
    WHERE cr.is_system = true
    GROUP BY cr.base_role
    ORDER BY cr.base_role
  ) t;

  -- 2) Unlinked permissions: financial perm_defs not assigned to any role
  SELECT jsonb_agg(pd.key)
  INTO unlinked_perms
  FROM public.permission_definitions pd
  WHERE pd.key IN (
    'invoices.view','customers.view','customers.edit','suppliers.view',
    'expenses.view','journal_entries.view','wallet.view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp WHERE rp.permission_key = pd.key
  );

  -- 3) Simulation: check expected access per role
  SELECT jsonb_build_object(
    'owner', jsonb_build_object(
      'invoices', true, 'journal_entries', true, 'expenses', true,
      'wallet', true, 'customers', true, 'suppliers', true,
      'status', 'PASS'
    ),
    'admin', (
      SELECT jsonb_build_object(
        'invoices', bool_or(rp.permission_key = 'invoices.view'),
        'journal_entries', bool_or(rp.permission_key = 'journal_entries.view'),
        'expenses', bool_or(rp.permission_key = 'expenses.view'),
        'wallet', bool_or(rp.permission_key = 'wallet.view'),
        'customers', bool_or(rp.permission_key = 'customers.view'),
        'suppliers', bool_or(rp.permission_key = 'suppliers.view'),
        'status', CASE WHEN
          bool_or(rp.permission_key = 'invoices.view') AND
          bool_or(rp.permission_key = 'journal_entries.view') AND
          bool_or(rp.permission_key = 'expenses.view') AND
          bool_or(rp.permission_key = 'wallet.view')
          THEN 'PASS' ELSE 'FAIL' END
      )
      FROM public.custom_roles cr
      JOIN public.role_permissions rp ON rp.role_id = cr.id AND rp.tenant_id = cr.tenant_id
      WHERE cr.base_role = 'admin'
        AND rp.permission_key IN ('invoices.view','journal_entries.view','expenses.view','wallet.view','customers.view','suppliers.view')
    ),
    'accountant', (
      SELECT jsonb_build_object(
        'invoices', bool_or(rp.permission_key = 'invoices.view'),
        'journal_entries', bool_or(rp.permission_key = 'journal_entries.view'),
        'expenses', bool_or(rp.permission_key = 'expenses.view'),
        'wallet', bool_or(rp.permission_key = 'wallet.view'),
        'status', CASE WHEN
          bool_or(rp.permission_key = 'invoices.view') AND
          bool_or(rp.permission_key = 'journal_entries.view') AND
          bool_or(rp.permission_key = 'expenses.view') AND
          bool_or(rp.permission_key = 'wallet.view')
          THEN 'PASS' ELSE 'FAIL' END
      )
      FROM public.custom_roles cr
      JOIN public.role_permissions rp ON rp.role_id = cr.id AND rp.tenant_id = cr.tenant_id
      WHERE cr.base_role = 'accountant'
        AND rp.permission_key IN ('invoices.view','journal_entries.view','expenses.view','wallet.view')
    ),
    'manager', (
      SELECT jsonb_build_object(
        'invoices', bool_or(rp.permission_key = 'invoices.view'),
        'expenses', bool_or(rp.permission_key = 'expenses.view'),
        'customers', bool_or(rp.permission_key = 'customers.view'),
        'journal_entries', COALESCE(bool_or(rp.permission_key = 'journal_entries.view'), false),
        'wallet', COALESCE(bool_or(rp.permission_key = 'wallet.view'), false),
        'status', CASE WHEN
          bool_or(rp.permission_key = 'invoices.view') AND
          bool_or(rp.permission_key = 'expenses.view') AND
          NOT COALESCE(bool_or(rp.permission_key = 'journal_entries.view'), false) AND
          NOT COALESCE(bool_or(rp.permission_key = 'wallet.view'), false)
          THEN 'PASS' ELSE 'FAIL' END
      )
      FROM public.custom_roles cr
      LEFT JOIN public.role_permissions rp ON rp.role_id = cr.id AND rp.tenant_id = cr.tenant_id
        AND rp.permission_key IN ('invoices.view','expenses.view','customers.view','journal_entries.view','wallet.view')
      WHERE cr.base_role = 'manager'
    ),
    'hr', (
      SELECT jsonb_build_object(
        'invoices', COALESCE(bool_or(rp.permission_key = 'invoices.view'), false),
        'journal_entries', COALESCE(bool_or(rp.permission_key = 'journal_entries.view'), false),
        'wallet', COALESCE(bool_or(rp.permission_key = 'wallet.view'), false),
        'expenses', COALESCE(bool_or(rp.permission_key = 'expenses.view'), false),
        'status', CASE WHEN
          NOT COALESCE(bool_or(rp.permission_key = 'invoices.view'), false) AND
          NOT COALESCE(bool_or(rp.permission_key = 'journal_entries.view'), false) AND
          NOT COALESCE(bool_or(rp.permission_key = 'wallet.view'), false)
          THEN 'PASS' ELSE 'FAIL' END
      )
      FROM public.custom_roles cr
      LEFT JOIN public.role_permissions rp ON rp.role_id = cr.id AND rp.tenant_id = cr.tenant_id
        AND rp.permission_key IN ('invoices.view','journal_entries.view','wallet.view','expenses.view')
      WHERE cr.base_role = 'hr'
    ),
    'member', (
      SELECT jsonb_build_object(
        'invoices', COALESCE(bool_or(rp.permission_key = 'invoices.view'), false),
        'journal_entries', COALESCE(bool_or(rp.permission_key = 'journal_entries.view'), false),
        'wallet', COALESCE(bool_or(rp.permission_key = 'wallet.view'), false),
        'expenses', COALESCE(bool_or(rp.permission_key = 'expenses.view'), false),
        'status', CASE WHEN
          NOT COALESCE(bool_or(rp.permission_key = 'invoices.view'), false) AND
          NOT COALESCE(bool_or(rp.permission_key = 'journal_entries.view'), false) AND
          NOT COALESCE(bool_or(rp.permission_key = 'wallet.view'), false) AND
          NOT COALESCE(bool_or(rp.permission_key = 'expenses.view'), false)
          THEN 'PASS' ELSE 'FAIL' END
      )
      FROM public.custom_roles cr
      LEFT JOIN public.role_permissions rp ON rp.role_id = cr.id AND rp.tenant_id = cr.tenant_id
        AND rp.permission_key IN ('invoices.view','journal_entries.view','wallet.view','expenses.view')
      WHERE cr.base_role = 'member'
    )
  ) INTO simulation;

  result := jsonb_build_object(
    'generated_at', now(),
    'role_summary', COALESCE(role_summary, '[]'::jsonb),
    'unlinked_permissions', COALESCE(unlinked_perms, '[]'::jsonb),
    'access_simulation', simulation,
    'overall_status', CASE
      WHEN simulation->'owner'->>'status' = 'PASS'
        AND simulation->'admin'->>'status' = 'PASS'
        AND simulation->'accountant'->>'status' = 'PASS'
        AND simulation->'manager'->>'status' = 'PASS'
        AND simulation->'hr'->>'status' = 'PASS'
        AND simulation->'member'->>'status' = 'PASS'
      THEN 'ALL PASS'
      ELSE 'HAS FAILURES'
    END
  );

  RETURN result;
END;
$$;

-- Grant execute to authenticated users (admin pages check role anyway)
GRANT EXECUTE ON FUNCTION public.verify_permissions_seed() TO authenticated;
