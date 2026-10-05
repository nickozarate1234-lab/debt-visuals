CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  shortcut_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24),'hex'),
  mesada1_day int NOT NULL DEFAULT 1, mesada1_amount numeric NOT NULL DEFAULT 400,
  mesada2_day int NOT NULL DEFAULT 15, mesada2_amount numeric NOT NULL DEFAULT 200,
  io_cut_day int NOT NULL DEFAULT 25, io_pay_day int NOT NULL DEFAULT 12,
  yape_day int NOT NULL DEFAULT 15, yape_amount numeric NOT NULL DEFAULT 118.22,
  bbva_date date DEFAULT '2026-10-07', bbva_amount numeric NOT NULL DEFAULT 103.49,
  projection_months int NOT NULL DEFAULT 6,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE public.bcp_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  seq bigserial,
  date date,
  concept text NOT NULL,
  amount numeric NOT NULL,
  source text NOT NULL DEFAULT 'app',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.io_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  date date NOT NULL DEFAULT current_date,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Otros',
  amount numeric NOT NULL,
  source text NOT NULL DEFAULT 'app',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  concept text NOT NULL,
  original_amount numeric NOT NULL,
  num_installments int NOT NULL,
  monthly_amount numeric NOT NULL,
  first_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bcp_movements, public.io_expenses, public.installments TO authenticated;
GRANT ALL ON public.bcp_movements, public.io_expenses, public.installments TO service_role;
GRANT USAGE ON SEQUENCE public.bcp_movements_seq_seq TO authenticated, service_role;
ALTER TABLE public.bcp_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.io_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bcp" ON public.bcp_movements FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own io" ON public.io_expenses FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "own cuotas" ON public.installments FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE OR REPLACE FUNCTION public.init_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.profiles(user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id <> auth.uid()) THEN
    UPDATE public.bcp_movements SET user_id = auth.uid() WHERE user_id IS NULL;
    UPDATE public.io_expenses SET user_id = auth.uid() WHERE user_id IS NULL;
    UPDATE public.installments SET user_id = auth.uid() WHERE user_id IS NULL;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.init_my_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.init_my_account() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bcp_movements, public.io_expenses, public.installments;

INSERT INTO public.bcp_movements(date,concept,amount,seq) VALUES
('2026-09-12','Saldo inicial',127.2,1),
('2026-09-12','Papá colaboración con cena',40.0,2),
('2026-09-13','Gas',-30.0,3),
('2026-09-13','Plin, no me acuerdo a que',-3.5,4),
('2026-09-13','Mama para compras',0,5),
('2026-09-14','amortizacion para gas',13.0,6),
('2026-09-14','cashback extra',100.0,7),
('2026-09-16','mesada',200.0,8),
('2026-09-16','cuota yape',-118.22,9),
('2026-09-15','gastos varios',-22.5,10),
('2026-09-17','Wrap',-7.5,11),
('2026-09-17','yape mama menu',13.0,12),
('2026-09-17','Menu judi',18.5,13),
('2026-09-19','yape mass',18.0,14),
('2026-09-21','sobrante spotify',-11.9,15),
('2026-09-21','sobrante smart',120.0,16),
('2026-09-22','gaseosa',-3.5,17),
('2026-09-21','deso sobrante',22.5,18),
('2026-09-20','bebida natural mama sobrante',8.0,19),
(null,'wardaditos spotify',12.0,20),
(null,'Yape areche',-138.0,21),
(null,'futbol',-15.0,22),
(null,'almuerzo',15.0,23),
(null,'almuerzo',13.0,24),
(null,'ganancia areche',150.0,25),
(null,'ganancias dolares',33.37,26),
(null,'Pucho',-2.0,27),
(null,'Wardaditos spotify',-12.0,28),
(null,'Dona alejandro',-5.89,29),
(null,'sdf',11.78,30),
(null,'Pucho',-2.0,31),
(null,'pucho',-2.0,32);
INSERT INTO public.io_expenses(date,description,category,amount) VALUES
('2026-09-12','Poniendo al dia','Otros',372.48),
('2026-09-13','compras wong','Otros',99.77),
('2026-09-14','vendomatica','Comida',3.0),
('2026-09-14','almuerzo','Comida',18.0),
('2026-09-14','flavi helado','Comida',28.5),
('2026-09-15','vendomatica','Comida',3.0),
('2026-09-16','pago cashback','Otros',-100.0),
('2026-09-17','vendomatica','Comida',6.7),
('2026-09-17','menus','Comida',37.0),
('2026-09-17','Chifa','Comida',63.0),
('2026-09-20','helado y gaseosa flavi','Comida',7.8),
('2026-09-19','Prestamo mama mass','Comida',17.97),
('2026-09-20','poniendo al dia','Otros',167.79),
('2026-09-20','gasolina','Transporte',20.0),
('2026-09-21','smartfit','Suscripciones',119.9),
('2026-09-21','vendomatica','Comida',27.5),
('2026-09-24','menu y vendomatica','Comida',23.7),
('2026-09-25','vendomatica','Comida',19.24),
('2026-09-25','cashback','Otros',-10.29),
('2026-09-25','corrigiendo numeros','Comida',-174.9),
('2026-09-26','Melt cena','Comida',85.0),
('2026-09-26','Oxxo','Comida',11.8),
('2026-09-27','Farmacia','Salud',3.2),
('2026-09-27','Pasaje','Entretenimiento',143.41),
('2026-09-28','Cine doomsday','Entretenimiento',84.0),
('2026-09-28','Gasolina','Transporte',20.0),
('2026-09-29','Vendomatica','Comida',5.7),
('2026-09-29','Vendomatica','Comida',1.5),
('2026-09-29','mcdonalds del coño','Comida',50.6),
('2026-10-01','Comida y mas comida','Comida',10.0),
('2026-10-01','Donas','Comida',15.4),
('2026-10-02','Vendomatica','Comida',1.7),
('2026-10-02','Mcdonalds','Comida',24.4),
('2026-10-05','Gasolina','Transporte',30.0);
INSERT INTO public.installments(concept,original_amount,num_installments,monthly_amount,first_date) VALUES ('Antica Pizzeria (BBVA→iO cuotas)',109,3,39.23,'2026-10-12'),('Rappi',42.8,3,15.4,'2026-10-12');
SELECT setval('public.bcp_movements_seq_seq', (SELECT max(seq) FROM public.bcp_movements));