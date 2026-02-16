
-- Allow platform admins to read all invoices and contracts for company details
CREATE POLICY "Platform admins can view all invoices" ON public.invoices
  FOR SELECT USING (is_platform_admin());

CREATE POLICY "Platform admins can view all contracts" ON public.contracts
  FOR SELECT USING (is_platform_admin());
