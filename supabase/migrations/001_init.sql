-- ─── Profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'nco',
  rank        text,
  first_name  text,
  last_name   text,
  unit        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Soldiers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.soldiers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nco_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name  text NOT NULL,
  last_name   text NOT NULL,
  rank        text NOT NULL,
  mos         text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Counselings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.counselings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id       uuid NOT NULL REFERENCES public.soldiers(id) ON DELETE CASCADE,
  nco_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type             text NOT NULL,
  raw_input        jsonb,
  generated_output text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soldiers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counselings ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Soldiers
CREATE POLICY "soldiers_select_own" ON public.soldiers
  FOR SELECT USING (auth.uid() = nco_id);

CREATE POLICY "soldiers_insert_own" ON public.soldiers
  FOR INSERT WITH CHECK (auth.uid() = nco_id);

CREATE POLICY "soldiers_update_own" ON public.soldiers
  FOR UPDATE USING (auth.uid() = nco_id);

CREATE POLICY "soldiers_delete_own" ON public.soldiers
  FOR DELETE USING (auth.uid() = nco_id);

-- Counselings
CREATE POLICY "counselings_select_own" ON public.counselings
  FOR SELECT USING (auth.uid() = nco_id);

CREATE POLICY "counselings_insert_own" ON public.counselings
  FOR INSERT WITH CHECK (auth.uid() = nco_id);

CREATE POLICY "counselings_update_own" ON public.counselings
  FOR UPDATE USING (auth.uid() = nco_id);

CREATE POLICY "counselings_delete_own" ON public.counselings
  FOR DELETE USING (auth.uid() = nco_id);

-- ─── Auto-create profile on sign-up ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'nco')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
