
CREATE OR REPLACE FUNCTION public.update_product_stock(p_product_id uuid, p_quantity_change integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_qty integer;
BEGIN
  -- Lock the row to prevent concurrent updates
  SELECT quantity INTO current_qty
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  -- If reducing stock, ensure sufficient quantity
  IF p_quantity_change < 0 AND current_qty + p_quantity_change < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %', 
      p_product_id, current_qty, ABS(p_quantity_change);
  END IF;

  UPDATE products
  SET 
    quantity = quantity + p_quantity_change,
    updated_at = now()
  WHERE id = p_product_id;
END;
$function$;
