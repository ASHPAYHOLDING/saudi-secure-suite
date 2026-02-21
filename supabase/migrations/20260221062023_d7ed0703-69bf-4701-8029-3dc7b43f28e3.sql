-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Fix: Platform admins must be able to SELECT audit_logs    ║
-- ║  Currently only is_tenant_admin() can read — super admins  ║
-- ║  who aren't tenant admins see 0 rows.                      ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE POLICY "Platform admins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (is_platform_admin());