import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the latest exchange rate from currency_rates table.
 * Falls back to 1 if no rate found or same currency.
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  tenantId: string
): Promise<number> {
  if (fromCurrency === toCurrency) return 1;

  // Direct rate
  const { data } = await supabase
    .from("currency_rates")
    .select("rate")
    .eq("tenant_id", tenantId)
    .eq("from_currency", fromCurrency)
    .eq("to_currency", toCurrency)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.rate) return data.rate;

  // Try reverse
  const { data: rev } = await supabase
    .from("currency_rates")
    .select("rate")
    .eq("tenant_id", tenantId)
    .eq("from_currency", toCurrency)
    .eq("to_currency", fromCurrency)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rev?.rate) return 1 / rev.rate;

  return 1;
}

/**
 * Convert an amount to the base currency (SAR by default).
 * Returns { baseAmount, exchangeRate }.
 */
export async function convertToBase(
  amount: number,
  currencyCode: string,
  tenantId: string,
  baseCurrency = "SAR"
): Promise<{ baseAmount: number; exchangeRate: number }> {
  const exchangeRate = await getExchangeRate(currencyCode, baseCurrency, tenantId);
  return {
    baseAmount: Math.round(amount * exchangeRate * 100) / 100,
    exchangeRate,
  };
}

/**
 * Fetches all active currencies from the currencies table.
 */
export async function fetchCurrencies() {
  const { data } = await (supabase as any)
    .from("currencies")
    .select("code, name_ar, name_en, symbol, is_base, decimal_places")
    .eq("is_active", true)
    .order("is_base", { ascending: false });
  return (data || []) as {
    code: string;
    name_ar: string;
    name_en: string | null;
    symbol: string;
    is_base: boolean;
    decimal_places: number;
  }[];
}
