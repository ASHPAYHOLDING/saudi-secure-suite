-- Add branch_color to branches table
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS branch_color text DEFAULT '#0f4c81';