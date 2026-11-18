-- Credit line per card, purchase date on installments, and an atomic
-- "convert a card expense into installments" operation.
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS credit_limit numeric;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS purchase_date date;

-- Moves a card expense out of its statement and into installments, in one transaction.
-- SECURITY INVOKER: row-level security still applies, so users only touch their own rows.
CREATE OR REPLACE FUNCTION public.expense_to_installments(
  p_expense_id uuid,
  p_num integer,
  p_monthly numeric,
  p_original numeric,
  p_first_date date
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  e public.io_expenses%ROWTYPE;
  new_id uuid;
BEGIN
  IF p_num IS NULL OR p_num < 1 OR p_num > 60 OR p_monthly IS NULL OR p_monthly <= 0 OR p_original IS NULL OR p_original <= 0 OR p_first_date IS NULL THEN
    RAISE EXCEPTION 'Datos de cuotas inválidos';
  END IF;
  SELECT * INTO e FROM public.io_expenses WHERE id = p_expense_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gasto no encontrado';
  END IF;
  INSERT INTO public.installments (user_id, concept, original_amount, num_installments, monthly_amount, first_date, account_id, purchase_date)
  VALUES (auth.uid(), e.description, p_original, p_num, p_monthly, p_first_date, e.account_id, e.date)
  RETURNING id INTO new_id;
  DELETE FROM public.io_expenses WHERE id = e.id;
  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.expense_to_installments(uuid, integer, numeric, numeric, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expense_to_installments(uuid, integer, numeric, numeric, date) TO authenticated;
