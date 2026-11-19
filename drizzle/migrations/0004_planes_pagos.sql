-- Plans (free limit + Pro) and Mercado Pago payments.

-- New users must not inherit the original owner's numbers as defaults.
ALTER TABLE public.profiles ALTER COLUMN mesada1_amount SET DEFAULT 0;
ALTER TABLE public.profiles ALTER COLUMN mesada2_amount SET DEFAULT 0;
ALTER TABLE public.profiles ALTER COLUMN yape_amount SET DEFAULT 0;
ALTER TABLE public.profiles ALTER COLUMN bbva_amount SET DEFAULT 0;
ALTER TABLE public.profiles ALTER COLUMN bbva_date DROP DEFAULT;

-- Pro status lives outside profiles: users can read it but only the server (service_role) writes it.
CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id uuid PRIMARY KEY,
  pro_until timestamptz,
  lifetime boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own plan" ON public.user_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_payment_id text NOT NULL,
  plan text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_pro(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_plans WHERE user_id = p_user AND (lifetime OR pro_until > now()));
$$;

CREATE OR REPLACE FUNCTION public.record_count(p_user uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ((SELECT count(*) FROM public.bcp_movements WHERE user_id = p_user)
        + (SELECT count(*) FROM public.io_expenses WHERE user_id = p_user))::int;
$$;

-- Free plan: up to 200 records (debit movements + card expenses). Enforced in the database,
-- so it applies to the app, voice, vouchers and the iPhone shortcut alike.
CREATE OR REPLACE FUNCTION public.enforce_free_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL OR public.is_pro(NEW.user_id) THEN RETURN NEW; END IF;
  IF public.record_count(NEW.user_id) >= 200 THEN
    RAISE EXCEPTION 'LIMITE_GRATIS' USING HINT = 'Activa Pro para seguir registrando';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS free_limit ON public.bcp_movements;
CREATE TRIGGER free_limit BEFORE INSERT ON public.bcp_movements FOR EACH ROW EXECUTE FUNCTION public.enforce_free_limit();
DROP TRIGGER IF EXISTS free_limit ON public.io_expenses;
CREATE TRIGGER free_limit BEFORE INSERT ON public.io_expenses FOR EACH ROW EXECUTE FUNCTION public.enforce_free_limit();

-- What the app shows: plan state and usage of the signed-in user.
CREATE OR REPLACE FUNCTION public.my_plan() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'pro', public.is_pro(auth.uid()),
    'lifetime', COALESCE((SELECT lifetime FROM public.user_plans WHERE user_id = auth.uid()), false),
    'pro_until', (SELECT pro_until FROM public.user_plans WHERE user_id = auth.uid()),
    'used', public.record_count(auth.uid()),
    'limit', 200
  );
$$;

-- Records a provider payment and, the first time it is approved, extends Pro by p_days.
-- Idempotent (webhook retries, double confirmation). Server only.
CREATE OR REPLACE FUNCTION public.apply_payment(
  p_provider_payment_id text, p_user uuid, p_plan text, p_amount numeric, p_currency text, p_status text, p_days integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  was_applied boolean;
BEGIN
  INSERT INTO public.payments (user_id, provider_payment_id, plan, amount, currency, status)
  VALUES (p_user, p_provider_payment_id, p_plan, p_amount, p_currency, p_status)
  ON CONFLICT (provider, provider_payment_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now();

  SELECT applied INTO was_applied FROM public.payments
  WHERE provider = 'mercadopago' AND provider_payment_id = p_provider_payment_id FOR UPDATE;
  IF p_status <> 'approved' OR was_applied THEN RETURN false; END IF;

  UPDATE public.payments SET applied = true, updated_at = now()
  WHERE provider = 'mercadopago' AND provider_payment_id = p_provider_payment_id;
  INSERT INTO public.user_plans (user_id, pro_until) VALUES (p_user, now() + make_interval(days => p_days))
  ON CONFLICT (user_id) DO UPDATE
    SET pro_until = GREATEST(COALESCE(public.user_plans.pro_until, now()), now()) + make_interval(days => p_days), updated_at = now();
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.apply_payment(text, uuid, text, numeric, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment(text, uuid, text, numeric, text, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.is_pro(uuid), public.record_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_pro(uuid), public.record_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_plan() TO authenticated;
