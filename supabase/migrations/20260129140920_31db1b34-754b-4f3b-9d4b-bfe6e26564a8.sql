-- Drop the restrictive sale_items view policy
DROP POLICY IF EXISTS "Users can view own sale items" ON public.sale_items;

-- Create a new policy that allows all authenticated users to view all sale items
CREATE POLICY "Authenticated users can view all sale items"
ON public.sale_items
FOR SELECT
USING (auth.uid() IS NOT NULL);