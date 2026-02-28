-- Customers: sales and invoices reference customers
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_customer_id_fkey;
ALTER TABLE public.sales ADD CONSTRAINT sales_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- Products: sale_items reference products
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- Make product_id nullable since it can now be null after product deletion
ALTER TABLE public.sale_items ALTER COLUMN product_id DROP NOT NULL;

-- Suppliers: supplier_products reference suppliers
ALTER TABLE public.supplier_products DROP CONSTRAINT IF EXISTS supplier_products_supplier_id_fkey;
ALTER TABLE public.supplier_products ADD CONSTRAINT supplier_products_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;

-- Invoices: invoice_items reference invoices
ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- Invoices: converted_from self-reference
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_converted_from_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_converted_from_fkey
  FOREIGN KEY (converted_from) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Credits: reference sales
ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_sale_id_fkey;
ALTER TABLE public.credits ADD CONSTRAINT credits_sale_id_fkey
  FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

-- Credit payments: reference credits
ALTER TABLE public.credit_payments DROP CONSTRAINT IF EXISTS credit_payments_credit_id_fkey;
ALTER TABLE public.credit_payments ADD CONSTRAINT credit_payments_credit_id_fkey
  FOREIGN KEY (credit_id) REFERENCES public.credits(id) ON DELETE CASCADE;

-- Cash box: reference sales
ALTER TABLE public.cash_box DROP CONSTRAINT IF EXISTS cash_box_sale_id_fkey;
ALTER TABLE public.cash_box ADD CONSTRAINT cash_box_sale_id_fkey
  FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;

-- Sale items: reference sales
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_sale_id_fkey
  FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;