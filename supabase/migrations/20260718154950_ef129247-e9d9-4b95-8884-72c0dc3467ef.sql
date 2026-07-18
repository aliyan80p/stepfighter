ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'main';
CREATE INDEX IF NOT EXISTS questions_qbank_source_idx ON public.questions (qbank_id, source);