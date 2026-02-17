-- Add paylink_transaction_no column to track Paylink's transaction reference
ALTER TABLE public.paylink_transactions
ADD COLUMN IF NOT EXISTS paylink_transaction_no text;

-- Create index for fast lookup by Paylink transaction number
CREATE INDEX IF NOT EXISTS idx_paylink_transactions_paylink_no
ON public.paylink_transactions (paylink_transaction_no)
WHERE paylink_transaction_no IS NOT NULL;
