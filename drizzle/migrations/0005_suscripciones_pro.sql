-- Monthly Pro as a Mercado Pago subscription (preapproval): charged automatically each month.
CREATE TABLE IF NOT EXISTS public.pro_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_subscription_id text NOT NULL,
  status text NOT NULL,
  paid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id)
);
GRANT SELECT ON public.pro_subscriptions TO authenticated;
GRANT ALL ON public.pro_subscriptions TO service_role;
ALTER TABLE public.pro_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own pro subscription" ON public.pro_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Records the subscription state and, when a charge went through, extends Pro to p_paid_until.
-- Never shortens Pro: a cancelled subscription keeps access until the period already paid ends. Server only.
CREATE OR REPLACE FUNCTION public.apply_subscription(p_subscription_id text, p_user uuid, p_status text, p_paid_until timestamptz)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.pro_subscriptions (user_id, provider_subscription_id, status, paid_until)
  VALUES (p_user, p_subscription_id, p_status, p_paid_until)
  ON CONFLICT (provider, provider_subscription_id) DO UPDATE
    SET status = EXCLUDED.status,
        paid_until = GREATEST(public.pro_subscriptions.paid_until, EXCLUDED.paid_until),
        updated_at = now();
  IF p_paid_until IS NOT NULL THEN
    INSERT INTO public.user_plans (user_id, pro_until) VALUES (p_user, p_paid_until)
    ON CONFLICT (user_id) DO UPDATE
      SET pro_until = GREATEST(COALESCE(public.user_plans.pro_until, p_paid_until), p_paid_until), updated_at = now();
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.apply_subscription(text, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription(text, uuid, text, timestamptz) TO service_role;

-- my_plan also reports the active monthly subscription, so the app can offer "cancel".
CREATE OR REPLACE FUNCTION public.my_plan() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'pro', public.is_pro(auth.uid()),
    'lifetime', COALESCE((SELECT lifetime FROM public.user_plans WHERE user_id = auth.uid()), false),
    'pro_until', (SELECT pro_until FROM public.user_plans WHERE user_id = auth.uid()),
    'used', public.record_count(auth.uid()),
    'limit', 200,
    'subscription', (SELECT json_build_object('id', provider_subscription_id, 'status', status, 'paid_until', paid_until)
                     FROM public.pro_subscriptions WHERE user_id = auth.uid() ORDER BY updated_at DESC LIMIT 1)
  );
$$;
GRANT EXECUTE ON FUNCTION public.my_plan() TO authenticated;
