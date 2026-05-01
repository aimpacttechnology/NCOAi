CREATE TABLE IF NOT EXISTS public.promotion_data (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id      uuid UNIQUE NOT NULL REFERENCES public.soldiers(id) ON DELETE CASCADE,
  nco_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_rank     text NOT NULL DEFAULT 'SGT',
  tis_months      int NOT NULL DEFAULT 0,
  tig_months      int NOT NULL DEFAULT 0,
  acft_score      int NOT NULL DEFAULT 0,
  weapons_qual    text NOT NULL DEFAULT 'Unqualified',
  wlc_complete    boolean NOT NULL DEFAULT false,
  alc_complete    boolean NOT NULL DEFAULT false,
  slc_complete    boolean NOT NULL DEFAULT false,
  awards          jsonb NOT NULL DEFAULT '{}',
  degree          text NOT NULL DEFAULT 'None',
  college_credits int NOT NULL DEFAULT 0,
  extra_courses   int NOT NULL DEFAULT 0,
  updated_at      timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.promotion_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_select_own" ON public.promotion_data
  FOR SELECT USING (auth.uid() = nco_id);
CREATE POLICY "promo_insert_own" ON public.promotion_data
  FOR INSERT WITH CHECK (auth.uid() = nco_id);
CREATE POLICY "promo_update_own" ON public.promotion_data
  FOR UPDATE USING (auth.uid() = nco_id);
CREATE POLICY "promo_delete_own" ON public.promotion_data
  FOR DELETE USING (auth.uid() = nco_id);
