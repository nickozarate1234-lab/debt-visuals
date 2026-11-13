CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'debito',
  legacy text,
  cut_day integer NOT NULL DEFAULT 25,
  pay_day integer NOT NULL DEFAULT 12,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX accounts_user_legacy ON public.accounts(user_id, legacy) WHERE legacy IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  monthly_amount numeric NOT NULL,
  pay_day integer NOT NULL DEFAULT 15,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  num_payments integer,
  pay_account_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debts" ON public.debts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.bcp_movements ADD COLUMN account_id uuid;
ALTER TABLE public.bcp_movements ADD COLUMN transfer_id uuid;
ALTER TABLE public.bcp_movements ADD COLUMN paid_card_id uuid;
ALTER TABLE public.io_expenses ADD COLUMN account_id uuid;
ALTER TABLE public.installments ADD COLUMN account_id uuid;

INSERT INTO public.accounts (user_id, name, kind, legacy)
  SELECT user_id, 'BCP', 'debito', 'bcp' FROM public.profiles;
INSERT INTO public.accounts (user_id, name, kind, legacy, cut_day, pay_day)
  SELECT user_id, 'iO', 'credito', 'io', io_cut_day, io_pay_day FROM public.profiles;
INSERT INTO public.debts (user_id, name, monthly_amount, pay_day, start_date, num_payments)
  SELECT user_id, 'Crédito Yape', yape_amount, yape_day, CURRENT_DATE, NULL FROM public.profiles WHERE yape_amount > 0;
INSERT INTO public.debts (user_id, name, monthly_amount, pay_day, start_date, num_payments)
  SELECT user_id, 'BBVA', bbva_amount, EXTRACT(DAY FROM bbva_date)::int, bbva_date, 1 FROM public.profiles WHERE bbva_amount > 0 AND bbva_date IS NOT NULL;

COMMENT ON COLUMN public.profiles.yape_amount IS 'DEPRECATED: replaced by debts';
COMMENT ON COLUMN public.profiles.bbva_amount IS 'DEPRECATED: replaced by debts';

ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts, public.debts;