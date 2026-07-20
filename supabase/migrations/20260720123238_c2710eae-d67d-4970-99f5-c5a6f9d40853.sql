
CREATE INDEX IF NOT EXISTS idx_questions_qbank_id_id ON public.questions (qbank_id, id);
CREATE INDEX IF NOT EXISTS idx_questions_qbank_source ON public.questions (qbank_id, source) WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attempts_user_qbank_created ON public.attempts (user_id, qbank_id, created_at);
ANALYZE public.questions;
ANALYZE public.attempts;
