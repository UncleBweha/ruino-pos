
-- Create casuals table for casual worker profiles
CREATE TABLE public.casuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.casuals ENABLE ROW LEVEL SECURITY;

-- Admins can manage casuals
CREATE POLICY "Admins can manage casuals"
ON public.casuals
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view active casuals (needed for POS dropdown)
CREATE POLICY "Authenticated users can view casuals"
ON public.casuals
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add sold_on_behalf columns to sales table
ALTER TABLE public.sales
ADD COLUMN sold_on_behalf_of UUID REFERENCES public.casuals(id),
ADD COLUMN sold_on_behalf_name TEXT;

-- Add commission column to sales table
ALTER TABLE public.sales
ADD COLUMN commission_amount NUMERIC NOT NULL DEFAULT 0;

-- Create trigger for casuals updated_at
CREATE TRIGGER update_casuals_updated_at
BEFORE UPDATE ON public.casuals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_casuals_status ON public.casuals(status);
CREATE INDEX idx_sales_sold_on_behalf ON public.sales(sold_on_behalf_of) WHERE sold_on_behalf_of IS NOT NULL;
