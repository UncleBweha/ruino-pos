-- ============================================================
-- Comprehensive migration: inventory separation, sales returns,
-- stock transfers, and all required columns
-- Run this if prior migrations haven't been applied yet.
-- All statements are idempotent (safe to re-run).
-- ============================================================

-- 1. Add warehouse_quantity and damaged_quantity to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS warehouse_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_quantity   integer NOT NULL DEFAULT 0;

-- Ensure no negative values
UPDATE public.products SET warehouse_quantity = 0 WHERE warehouse_quantity < 0;
UPDATE public.products SET damaged_quantity   = 0 WHERE damaged_quantity   < 0;

-- 2. Stock Transfers log table
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id   uuid    REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text    NOT NULL,
  source       text    NOT NULL,     -- 'warehouse' | 'shop'
  destination  text    NOT NULL,     -- 'shop' | 'warehouse'
  quantity     integer NOT NULL CHECK (quantity > 0),
  created_by   text    NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stock_transfers' AND policyname = 'stock_transfers_select'
  ) THEN
    CREATE POLICY stock_transfers_select ON public.stock_transfers
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stock_transfers' AND policyname = 'stock_transfers_insert'
  ) THEN
    CREATE POLICY stock_transfers_insert ON public.stock_transfers
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END$$;

-- 3. Sales Returns table
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id      uuid    REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id   uuid    REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text    NOT NULL,
  quantity     integer NOT NULL CHECK (quantity > 0),
  reason       text,
  resolution   text    CHECK (resolution IN ('refund', 'replacement')),
  notes        text,
  created_by   text,
  created_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sales_returns' AND policyname = 'sales_returns_select'
  ) THEN
    CREATE POLICY sales_returns_select ON public.sales_returns
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sales_returns' AND policyname = 'sales_returns_insert'
  ) THEN
    CREATE POLICY sales_returns_insert ON public.sales_returns
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END$$;

-- 4. Ensure supplier_products has destination column
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS destination text DEFAULT 'warehouse';

-- 5. Ensure returns_damages has resolution column
ALTER TABLE public.returns_damages
  ADD COLUMN IF NOT EXISTS resolution text
    CHECK (resolution IN ('refund', 'replacement'));

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_warehouse_qty  ON public.products (warehouse_quantity);
CREATE INDEX IF NOT EXISTS idx_products_damaged_qty    ON public.products (damaged_quantity);
CREATE INDEX IF NOT EXISTS idx_sales_returns_sale_id   ON public.sales_returns (sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_product   ON public.sales_returns (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_product ON public.stock_transfers (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_created ON public.stock_transfers (created_at DESC);
