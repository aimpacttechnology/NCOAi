CREATE TABLE IF NOT EXISTS public.tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id   uuid NOT NULL REFERENCES public.soldiers(id) ON DELETE CASCADE,
  nco_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  category     text NOT NULL DEFAULT 'General',
  priority     text NOT NULL DEFAULT 'Normal',
  status       text NOT NULL DEFAULT 'pending',
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (auth.uid() = nco_id);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = nco_id);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (auth.uid() = nco_id);
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (auth.uid() = nco_id);

CREATE INDEX tasks_soldier_idx ON public.tasks (soldier_id);
CREATE INDEX tasks_nco_idx     ON public.tasks (nco_id);
CREATE INDEX tasks_status_idx  ON public.tasks (status);
CREATE INDEX tasks_due_idx     ON public.tasks (due_date);
