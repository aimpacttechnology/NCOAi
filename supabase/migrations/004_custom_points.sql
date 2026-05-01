ALTER TABLE public.promotion_data
  ADD COLUMN IF NOT EXISTS custom_points jsonb NOT NULL DEFAULT '[]';
