-- Drop the restrictive cashier policy
DROP POLICY IF EXISTS "Cashiers can view own sales" ON public.sales;

-- Create a new policy that allows all authenticated users to view all sales
CREATE POLICY "Authenticated users can view all sales"
ON public.sales
FOR SELECT
USING (auth.uid() IS NOT NULL);