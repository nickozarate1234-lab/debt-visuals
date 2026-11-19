-- Hardening + AI usage limits.

-- 1) Anonymous visitors get nothing on app tables (RLS already blocked rows; this removes the grants too).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Signed-in users: only the operations the app uses, never TRUNCATE/TRIGGER/REFERENCES.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
-- Plans and payments are written only by the server.
REVOKE INSERT, UPDATE, DELETE ON public.user_plans, public.payments, public.pro_subscriptions FROM authenticated;

-- Functions: anonymous visitors can't call any; triggers don't need direct execution.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_free_limit() FROM PUBLIC, authenticated;

-- 2) AI usage: daily cap per user (free 10, Pro 60) and a global daily cap that protects the Gemini quota.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id uuid NOT NULL,
  day date NOT NULL,
  uses integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage FROM anon, authenticated;
GRANT ALL ON public.ai_usage TO service_role;

-- Atomically takes one AI use if both limits allow it. Server only.
CREATE OR REPLACE FUNCTION public.consume_ai(p_user uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today date := (now() AT TIME ZONE 'America/Lima')::date;
  global_id constant uuid := '00000000-0000-0000-0000-000000000000';
  user_limit int := CASE WHEN public.is_pro(p_user) THEN 60 ELSE 10 END;
  global_limit constant int := 900;
  used int;
  g int;
BEGIN
  SELECT uses INTO g FROM public.ai_usage WHERE user_id = global_id AND day = today FOR UPDATE;
  IF COALESCE(g, 0) >= global_limit THEN
    RETURN json_build_object('ok', false, 'reason', 'global', 'used', NULL, 'limit', user_limit);
  END IF;
  INSERT INTO public.ai_usage (user_id, day, uses) VALUES (p_user, today, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET uses = public.ai_usage.uses + 1 WHERE public.ai_usage.uses < user_limit
  RETURNING uses INTO used;
  IF used IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'user', 'used', user_limit, 'limit', user_limit);
  END IF;
  INSERT INTO public.ai_usage (user_id, day, uses) VALUES (global_id, today, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET uses = public.ai_usage.uses + 1;
  RETURN json_build_object('ok', true, 'used', used, 'limit', user_limit);
END $$;
REVOKE ALL ON FUNCTION public.consume_ai(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai(uuid) TO service_role;
