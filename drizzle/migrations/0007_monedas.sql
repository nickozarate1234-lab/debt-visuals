-- Soles and dollars: currency per account, salary and subscription; main currency and exchange rate per user.

-- Main currency. Existing users stay in soles and skip the welcome step (currency_set = true);
-- new profiles start with currency_set = false so the app asks once.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PEN' CHECK (currency IN ('PEN', 'USD'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency_set boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN currency_set SET DEFAULT false;
-- Own exchange rate (soles per dollar). NULL = use today's automatic rate.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS usd_rate numeric CHECK (usd_rate IS NULL OR usd_rate > 0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mesada1_currency text NOT NULL DEFAULT 'PEN' CHECK (mesada1_currency IN ('PEN', 'USD'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mesada2_currency text NOT NULL DEFAULT 'PEN' CHECK (mesada2_currency IN ('PEN', 'USD'));

-- Every account and card has one currency; its movements, expenses and cuotas are in it.
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PEN' CHECK (currency IN ('PEN', 'USD'));
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PEN' CHECK (currency IN ('PEN', 'USD'));

-- Card payment from an account in another currency: amount credited to the card, in the card's currency.
-- NULL = same currency, the movement's amount is what the card receives.
ALTER TABLE public.bcp_movements ADD COLUMN IF NOT EXISTS card_amount numeric;

-- Daily exchange rate shared by everyone (soles per dollar). Written only by the server.
CREATE TABLE IF NOT EXISTS public.fx_rates (
  pair text PRIMARY KEY,
  rate numeric NOT NULL CHECK (rate > 0),
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fx_rates FROM anon, authenticated;
GRANT SELECT ON public.fx_rates TO authenticated;
GRANT ALL ON public.fx_rates TO service_role;
DROP POLICY IF EXISTS "read rates" ON public.fx_rates;
CREATE POLICY "read rates" ON public.fx_rates FOR SELECT TO authenticated USING (true);
