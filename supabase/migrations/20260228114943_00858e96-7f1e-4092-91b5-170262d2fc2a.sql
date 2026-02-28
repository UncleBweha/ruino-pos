ALTER TABLE public.sales
  DROP CONSTRAINT sales_sold_on_behalf_of_fkey;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_sold_on_behalf_of_fkey
  FOREIGN KEY (sold_on_behalf_of) REFERENCES public.casuals(id) ON DELETE SET NULL;