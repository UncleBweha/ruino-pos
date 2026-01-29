-- Update the generate_receipt_number function to use simple sequential numbers starting from 001
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    seq_num INTEGER;
    receipt TEXT;
BEGIN
    -- Get the max receipt number and increment
    SELECT COALESCE(MAX(CAST(receipt_number AS INTEGER)), 0) + 1
    INTO seq_num
    FROM public.sales
    WHERE receipt_number ~ '^[0-9]+$';
    
    -- If no numeric receipts exist yet, start from 1
    IF seq_num IS NULL OR seq_num = 1 THEN
        -- Check if there are any sales at all
        SELECT COUNT(*) + 1 INTO seq_num FROM public.sales;
        IF seq_num > 1 THEN
            seq_num := seq_num;
        ELSE
            seq_num := 1;
        END IF;
    END IF;
    
    -- Format as 3-digit padded number (001, 002, etc.)
    receipt := LPAD(seq_num::TEXT, 3, '0');
    RETURN receipt;
END;
$function$;