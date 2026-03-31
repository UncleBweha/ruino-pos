-- Add warehouse and damaged inventory quantities to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS warehouse_quantity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS damaged_quantity integer DEFAULT 0;

-- Stock Transfers table
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    product_name text NOT NULL,
    source text NOT NULL,
    destination text NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by text NOT NULL
);

-- RLS policies for stock_transfers
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.stock_transfers
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.stock_transfers
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add resolution to returns_damages
ALTER TABLE public.returns_damages
ADD COLUMN IF NOT EXISTS resolution text;

-- Allow policies to be created
