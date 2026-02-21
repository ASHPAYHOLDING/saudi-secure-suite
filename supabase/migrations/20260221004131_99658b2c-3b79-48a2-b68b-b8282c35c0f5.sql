
-- 1) currencies reference table
CREATE TABLE IF NOT EXISTS public.currencies (
  code TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  symbol TEXT NOT NULL,
  is_base BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  decimal_places INT NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Currencies are readable by everyone" ON public.currencies FOR SELECT USING (true);
CREATE POLICY "Only admins can manage currencies" ON public.currencies FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner','admin'))
);

-- Seed common currencies
INSERT INTO public.currencies (code, name_ar, name_en, symbol, is_base) VALUES
  ('SAR', 'ريال سعودي', 'Saudi Riyal', 'ر.س', true),
  ('USD', 'دولار أمريكي', 'US Dollar', '$', false),
  ('EUR', 'يورو', 'Euro', '€', false),
  ('GBP', 'جنيه إسترليني', 'British Pound', '£', false),
  ('AED', 'درهم إماراتي', 'UAE Dirham', 'د.إ', false),
  ('KWD', 'دينار كويتي', 'Kuwaiti Dinar', 'د.ك', false),
  ('BHD', 'دينار بحريني', 'Bahraini Dinar', 'د.ب', false),
  ('QAR', 'ريال قطري', 'Qatari Riyal', 'ر.ق', false),
  ('OMR', 'ريال عماني', 'Omani Rial', 'ر.ع', false),
  ('EGP', 'جنيه مصري', 'Egyptian Pound', 'ج.م', false),
  ('JOD', 'دينار أردني', 'Jordanian Dinar', 'د.أ', false),
  ('TRY', 'ليرة تركية', 'Turkish Lira', '₺', false)
ON CONFLICT (code) DO NOTHING;

-- 2) Add multi-currency columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'SAR' REFERENCES public.currencies(code),
  ADD COLUMN IF NOT EXISTS exchange_rate_at_creation NUMERIC(18,8) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

-- 3) Add multi-currency columns to expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'SAR' REFERENCES public.currencies(code),
  ADD COLUMN IF NOT EXISTS exchange_rate_at_creation NUMERIC(18,8) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

-- 4) Add multi-currency columns to contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'SAR' REFERENCES public.currencies(code),
  ADD COLUMN IF NOT EXISTS exchange_rate_at_creation NUMERIC(18,8) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

-- 5) DB function to get latest exchange rate
CREATE OR REPLACE FUNCTION public.get_exchange_rate(p_from TEXT, p_to TEXT, p_tenant_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  IF p_from = p_to THEN RETURN 1; END IF;
  
  SELECT rate INTO v_rate
  FROM public.currency_rates
  WHERE tenant_id = p_tenant_id
    AND from_currency = p_from
    AND to_currency = p_to
  ORDER BY effective_date DESC
  LIMIT 1;
  
  IF v_rate IS NULL THEN
    -- Try reverse
    SELECT 1.0 / rate INTO v_rate
    FROM public.currency_rates
    WHERE tenant_id = p_tenant_id
      AND from_currency = p_to
      AND to_currency = p_from
    ORDER BY effective_date DESC
    LIMIT 1;
  END IF;
  
  RETURN COALESCE(v_rate, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
