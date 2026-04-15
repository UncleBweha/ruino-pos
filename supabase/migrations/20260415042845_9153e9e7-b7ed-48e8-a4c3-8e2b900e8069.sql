ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;

ALTER TABLE public.sales
ADD CONSTRAINT sales_payment_method_check
CHECK (
  payment_method = ANY (
    ARRAY[
      'cash'::text,
      'mpesa'::text,
      'credit'::text,
      'till'::text,
      'paybill'::text,
      'cheque'::text,
      'send_money'::text
    ]
  )
);