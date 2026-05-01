-- ─── Mentorship Sessions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentorship_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id      uuid NOT NULL REFERENCES public.soldiers(id) ON DELETE CASCADE,
  nco_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date    date NOT NULL DEFAULT CURRENT_DATE,
  focus_areas     text[] DEFAULT '{}',
  ai_talking_points text,
  nco_notes       text,
  follow_up_actions jsonb DEFAULT '[]',
  next_session_date date,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.mentorship_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor_select" ON public.mentorship_sessions FOR SELECT USING (auth.uid() = nco_id);
CREATE POLICY "mentor_insert" ON public.mentorship_sessions FOR INSERT WITH CHECK (auth.uid() = nco_id);
CREATE POLICY "mentor_update" ON public.mentorship_sessions FOR UPDATE USING (auth.uid() = nco_id);
CREATE POLICY "mentor_delete" ON public.mentorship_sessions FOR DELETE USING (auth.uid() = nco_id);

-- ─── Development Plans ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.development_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id      uuid NOT NULL REFERENCES public.soldiers(id) ON DELETE CASCADE,
  nco_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counseling_id   uuid REFERENCES public.counselings(id) ON DELETE SET NULL,
  plan_type       text NOT NULL DEFAULT 'initial', -- initial | semi-annual | annual
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  ai_plan         text,
  milestones      jsonb DEFAULT '[]', -- [{month, goal, actions, status, notes}]
  status          text NOT NULL DEFAULT 'active', -- active | complete | superseded
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.development_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_select" ON public.development_plans FOR SELECT USING (auth.uid() = nco_id);
CREATE POLICY "plans_insert" ON public.development_plans FOR INSERT WITH CHECK (auth.uid() = nco_id);
CREATE POLICY "plans_update" ON public.development_plans FOR UPDATE USING (auth.uid() = nco_id);
CREATE POLICY "plans_delete" ON public.development_plans FOR DELETE USING (auth.uid() = nco_id);

-- ─── NCO Wisdom Journal ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wisdom_journal (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nco_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  content     text NOT NULL,
  tags        text[] DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.wisdom_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_select" ON public.wisdom_journal FOR SELECT USING (auth.uid() = nco_id);
CREATE POLICY "journal_insert" ON public.wisdom_journal FOR INSERT WITH CHECK (auth.uid() = nco_id);
CREATE POLICY "journal_update" ON public.wisdom_journal FOR UPDATE USING (auth.uid() = nco_id);
CREATE POLICY "journal_delete" ON public.wisdom_journal FOR DELETE USING (auth.uid() = nco_id);
