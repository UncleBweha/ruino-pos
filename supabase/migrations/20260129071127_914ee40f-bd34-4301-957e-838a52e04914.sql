-- Fix function search path issues
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_date TEXT;
    seq_num INTEGER;
    receipt TEXT;
BEGIN
    today_date := TO_CHAR(NOW(), 'YYYYMMDD');
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 10) AS INTEGER)), 0) + 1
    INTO seq_num
    FROM public.sales
    WHERE receipt_number LIKE 'RGM' || today_date || '%';
    receipt := 'RGM' || today_date || LPAD(seq_num::TEXT, 4, '0');
    RETURN receipt;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Fix permissive RLS policies - drop and recreate with proper checks
DROP POLICY IF EXISTS "Authenticated users can create credits" ON public.credits;
CREATE POLICY "Authenticated users can create credits" ON public.credits
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sales 
            WHERE sales.id = credits.sale_id 
            AND sales.cashier_id = auth.uid()
        )
    );