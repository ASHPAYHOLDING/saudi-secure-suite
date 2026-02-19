
-- =====================================================
-- P0 FIX 1: Restrict subscription_plans to authenticated users only
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
CREATE POLICY "Authenticated users can view active plans"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (is_active = true);

-- =====================================================
-- P0 FIX 2: Restrict plan_entitlements to authenticated users only
-- =====================================================
DROP POLICY IF EXISTS "Anyone can read plan entitlements" ON public.plan_entitlements;
CREATE POLICY "Authenticated users can read plan entitlements"
  ON public.plan_entitlements FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- P0 FIX 3: Restrict subscription_discounts to authenticated users only
-- =====================================================
DROP POLICY IF EXISTS "Users can verify active discount codes" ON public.subscription_discounts;
CREATE POLICY "Authenticated users can verify active discount codes"
  ON public.subscription_discounts FOR SELECT TO authenticated
  USING (is_active = true AND starts_at <= now() AND expires_at > now());

-- =====================================================
-- P0 FIX 4: ZATCA ICV counter - restrict writes to system/admin only
-- =====================================================
DROP POLICY IF EXISTS "Tenant members can update their ICV counter" ON public.zatca_icv_counter;

-- Only allow incrementing via RPC or service role, not direct user writes
CREATE POLICY "Tenant admins can manage ICV counter"
  ON public.zatca_icv_counter FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- P1 FIX 5: Period locks - restrict INSERT/UPDATE to admin/owner
-- =====================================================
DROP POLICY IF EXISTS "Tenant members can manage period locks" ON public.period_locks;
DROP POLICY IF EXISTS "Tenant members can update period locks" ON public.period_locks;

CREATE POLICY "Admins can manage period locks"
  ON public.period_locks FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update period locks"
  ON public.period_locks FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- P1 FIX 6: Reconciliation issues - restrict UPDATE to admin/owner
-- =====================================================
DROP POLICY IF EXISTS "Tenant members update reconciliation_issues" ON public.reconciliation_issues;

CREATE POLICY "Admins can update reconciliation_issues"
  ON public.reconciliation_issues FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- P1 FIX 7: Inventory tables - split ALL into granular policies
-- =====================================================

-- inventory_movements
DROP POLICY IF EXISTS "Tenant isolation" ON public.inventory_movements;
CREATE POLICY "Tenant members can view inventory_movements"
  ON public.inventory_movements FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admins can manage inventory_movements"
  ON public.inventory_movements FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- warehouses
DROP POLICY IF EXISTS "Tenant isolation" ON public.warehouses;
CREATE POLICY "Tenant members can view warehouses"
  ON public.warehouses FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admins can manage warehouses"
  ON public.warehouses FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- product_variants
DROP POLICY IF EXISTS "Tenant isolation" ON public.product_variants;
CREATE POLICY "Tenant members can view product_variants"
  ON public.product_variants FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admins can manage product_variants"
  ON public.product_variants FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- goods_receipts
DROP POLICY IF EXISTS "Tenant isolation" ON public.goods_receipts;
CREATE POLICY "Tenant members can view goods_receipts"
  ON public.goods_receipts FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admins can manage goods_receipts"
  ON public.goods_receipts FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- goods_receipt_items
DROP POLICY IF EXISTS "Tenant isolation" ON public.goods_receipt_items;
CREATE POLICY "Tenant members can view goods_receipt_items"
  ON public.goods_receipt_items FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admins can manage goods_receipt_items"
  ON public.goods_receipt_items FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- warehouse_transfers
DROP POLICY IF EXISTS "Tenant isolation" ON public.warehouse_transfers;
CREATE POLICY "Tenant members can view warehouse_transfers"
  ON public.warehouse_transfers FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admins can manage warehouse_transfers"
  ON public.warehouse_transfers FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- warehouse_transfer_items
DROP POLICY IF EXISTS "Tenant isolation" ON public.warehouse_transfer_items;
CREATE POLICY "Tenant members can view warehouse_transfer_items"
  ON public.warehouse_transfer_items FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admins can manage warehouse_transfer_items"
  ON public.warehouse_transfer_items FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- stocktakes
DROP POLICY IF EXISTS "Tenant isolation" ON public.stocktakes;
CREATE POLICY "Tenant members can view stocktakes"
  ON public.stocktakes FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admins can manage stocktakes"
  ON public.stocktakes FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- stocktake_items
DROP POLICY IF EXISTS "Tenant isolation" ON public.stocktake_items;
CREATE POLICY "Tenant members can view stocktake_items"
  ON public.stocktake_items FOR SELECT TO authenticated
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Admins can manage stocktake_items"
  ON public.stocktake_items FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );
