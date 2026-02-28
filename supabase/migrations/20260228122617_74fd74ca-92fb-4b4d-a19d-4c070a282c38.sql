-- Speed up sales queries filtered by created_at and status (dashboard, reports, sales page)
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status_created ON public.sales (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_cashier_id ON public.sales (cashier_id);

-- Speed up sale_items queries by sale_id and created_at
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_created_at ON public.sale_items (created_at DESC);

-- Speed up cash_box queries filtered by date
CREATE INDEX IF NOT EXISTS idx_cash_box_created_at ON public.cash_box (created_at DESC);

-- Speed up credits queries by status
CREATE INDEX IF NOT EXISTS idx_credits_status ON public.credits (status);
CREATE INDEX IF NOT EXISTS idx_credits_sale_id ON public.credits (sale_id);

-- Speed up credit_payments by date
CREATE INDEX IF NOT EXISTS idx_credit_payments_created_at ON public.credit_payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_payments_credit_id ON public.credit_payments (credit_id);

-- Speed up products by name (search) and category
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products (name);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);

-- Speed up profiles lookup by user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- Speed up casuals by status
CREATE INDEX IF NOT EXISTS idx_casuals_status ON public.casuals (status);