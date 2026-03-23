
-- Add partial payment and GRN fields to supplier_products
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_reference text,
  ADD COLUMN IF NOT EXISTS grn_number text,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;

-- Update existing records: set balance = total_amount for unpaid, 0 for paid
UPDATE supplier_products SET balance = CASE WHEN payment_status = 'paid' THEN 0 ELSE total_amount END, amount_paid = CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END;

-- Supplier payments table for tracking individual payments
CREATE TABLE supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supply_record_id uuid REFERENCES supplier_products(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage supplier payments" ON supplier_payments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view supplier payments" ON supplier_payments FOR SELECT USING (auth.uid() IS NOT NULL);

-- Returns and damages tracking
CREATE TABLE returns_damages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supply_record_id uuid REFERENCES supplier_products(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  type text NOT NULL DEFAULT 'returned',
  reason text,
  date_returned timestamp with time zone NOT NULL DEFAULT now(),
  stock_adjusted boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE returns_damages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage returns damages" ON returns_damages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view returns damages" ON returns_damages FOR SELECT USING (auth.uid() IS NOT NULL);

-- GRN number generator function
CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  seq_num INTEGER;
  result TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(REPLACE(grn_number, 'GRN-', '') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM supplier_products
  WHERE grn_number LIKE 'GRN-%';

  result := 'GRN-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN result;
END;
$$;
