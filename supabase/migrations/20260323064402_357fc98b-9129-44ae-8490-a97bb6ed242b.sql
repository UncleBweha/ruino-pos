
CREATE OR REPLACE FUNCTION public.generate_invoice_number(doc_type text DEFAULT 'invoice'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
  result TEXT;
BEGIN
  IF doc_type = 'quotation' THEN
    prefix := 'QT-';
  ELSIF doc_type = 'proforma_invoice' THEN
    prefix := 'PI-';
  ELSE
    prefix := 'INV-';
  END IF;

  SELECT COALESCE(MAX(
    CAST(REPLACE(REPLACE(REPLACE(invoice_number, 'INV-', ''), 'QT-', ''), 'PI-', '') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.invoices
  WHERE invoice_number LIKE prefix || '%';

  result := prefix || LPAD(seq_num::TEXT, 4, '0');
  RETURN result;
END;
$function$;
