-- Add website and building columns to receipt_settings
ALTER TABLE public.receipt_settings
ADD COLUMN IF NOT EXISTS website text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS building text DEFAULT NULL;