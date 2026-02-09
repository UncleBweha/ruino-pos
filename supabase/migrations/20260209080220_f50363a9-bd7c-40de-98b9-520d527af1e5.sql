
-- ===========================
-- CUSTOMERS TABLE
-- ===========================
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  business_name TEXT,
  location TEXT,
  category TEXT DEFAULT 'retail',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert customers" ON public.customers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link sales to customers (optional)
ALTER TABLE public.sales ADD COLUMN customer_id UUID REFERENCES public.customers(id);

-- ===========================
-- SUPPLIERS TABLE
-- ===========================
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage suppliers" ON public.suppliers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================
-- SUPPLIER PRODUCTS (supply records)
-- ===========================
CREATE TABLE public.supplier_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  buying_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  supplied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage supplier products" ON public.supplier_products FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view supplier products" ON public.supplier_products FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ===========================
-- INVOICES TABLE
-- ===========================
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'invoice',
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_terms TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  converted_from UUID REFERENCES public.invoices(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view invoices" ON public.invoices FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create invoices" ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================
-- INVOICE ITEMS TABLE
-- ===========================
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invoice items" ON public.invoice_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view invoice items" ON public.invoice_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create invoice items" ON public.invoice_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ===========================
-- INVOICE NUMBER GENERATOR
-- ===========================
CREATE OR REPLACE FUNCTION public.generate_invoice_number(doc_type TEXT DEFAULT 'invoice')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
  result TEXT;
BEGIN
  IF doc_type = 'quotation' THEN
    prefix := 'QT-';
  ELSE
    prefix := 'INV-';
  END IF;

  SELECT COALESCE(MAX(
    CAST(REPLACE(REPLACE(invoice_number, 'INV-', ''), 'QT-', '') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.invoices
  WHERE invoice_number LIKE prefix || '%';

  result := prefix || LPAD(seq_num::TEXT, 4, '0');
  RETURN result;
END;
$$;
