
-- Allow authenticated users (cashiers) to update credits they created via their sales
CREATE POLICY "Authenticated users can update credits"
ON public.credits
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = credits.sale_id
    AND sales.cashier_id = auth.uid()
  )
);

-- Create storage bucket for invoice logos
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-logos', 'invoice-logos', true);

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoice-logos' AND auth.uid() IS NOT NULL);

-- Allow public read access to logos
CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-logos');

-- Allow authenticated users to update their logos
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'invoice-logos' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete logos
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'invoice-logos' AND auth.uid() IS NOT NULL);

-- Add logo_url column to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS logo_url text;
