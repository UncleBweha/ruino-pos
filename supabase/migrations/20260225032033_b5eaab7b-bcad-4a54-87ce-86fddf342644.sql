-- Allow admins to delete sale items (for partial returns)
CREATE POLICY "Admins can delete sale items"
ON public.sale_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow cashiers to delete sale items they created
CREATE POLICY "Cashiers can delete own sale items"
ON public.sale_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_items.sale_id
    AND sales.cashier_id = auth.uid()
  )
);