-- Create Sales Returns table
CREATE TABLE IF NOT EXISTS public.sales_returns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    quantity integer NOT NULL,
    reason text,
    resolution text,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by text
);

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.sales_returns FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.sales_returns FOR INSERT WITH CHECK (auth.role() = 'authenticated');
