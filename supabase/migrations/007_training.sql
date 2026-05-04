CREATE TABLE IF NOT EXISTS public.training_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nco_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  event_type      text NOT NULL DEFAULT 'drill_weekend',
  -- drill_weekend | annual_training | training_day | range_day | custom
  component       text NOT NULL DEFAULT 'guard_reserve',
  -- active | guard_reserve
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  location        text,
  unit            text,
  soldier_count   int DEFAULT 0,
  theme           text,
  mission_focus   text,
  opord           text,
  ai_schedule     text,
  status          text NOT NULL DEFAULT 'planning',
  -- planning | approved | complete
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lesson_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nco_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id        uuid REFERENCES public.training_events(id) ON DELETE SET NULL,
  title           text NOT NULL,
  duration_min    int NOT NULL DEFAULT 90,
  target_audience text NOT NULL DEFAULT 'All Soldiers',
  class_size_min  int DEFAULT 10,
  class_size_max  int DEFAULT 30,
  objectives      jsonb DEFAULT '[]',
  -- [{text: string, measurable: bool}]
  methods         text[] DEFAULT '{}',
  equipment       text[] DEFAULT '{}',
  references      text[] DEFAULT '{}',
  content_outline text,
  assessment_questions jsonb DEFAULT '[]',
  notes_to_trainer text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.training_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plans    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "te_select" ON public.training_events FOR SELECT USING (auth.uid() = nco_id);
CREATE POLICY "te_insert" ON public.training_events FOR INSERT WITH CHECK (auth.uid() = nco_id);
CREATE POLICY "te_update" ON public.training_events FOR UPDATE USING (auth.uid() = nco_id);
CREATE POLICY "te_delete" ON public.training_events FOR DELETE USING (auth.uid() = nco_id);

CREATE POLICY "lp_select" ON public.lesson_plans FOR SELECT USING (auth.uid() = nco_id);
CREATE POLICY "lp_insert" ON public.lesson_plans FOR INSERT WITH CHECK (auth.uid() = nco_id);
CREATE POLICY "lp_update" ON public.lesson_plans FOR UPDATE USING (auth.uid() = nco_id);
CREATE POLICY "lp_delete" ON public.lesson_plans FOR DELETE USING (auth.uid() = nco_id);
