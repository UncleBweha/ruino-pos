
-- Create credit_payments table to track individual payments for revenue attribution
CREATE TABLE public.credit_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_id uuid NOT NULL REFERENCES public.credits(id),
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  cashier_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view credit payments"
ON public.credit_payments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert credit payments"
ON public.credit_payments FOR INSERT
WITH CHECK (auth.uid() = cashier_id);

CREATE POLICY "Admins can manage credit payments"
ON public.credit_payments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_payments;
