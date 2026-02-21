
-- Add unique constraint for upsert support on currency_rates
CREATE UNIQUE INDEX IF NOT EXISTS idx_currency_rates_unique
  ON public.currency_rates (tenant_id, from_currency, to_currency, effective_date);
