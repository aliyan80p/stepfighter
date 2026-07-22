CREATE INDEX IF NOT EXISTS idx_questions_qbank_subject ON public.questions (qbank_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_qbank_system  ON public.questions (qbank_id, system_id);
CREATE INDEX IF NOT EXISTS idx_questions_qbank_title   ON public.questions (qbank_id, title);
CREATE INDEX IF NOT EXISTS idx_attempts_user_qbank_q   ON public.attempts  (user_id, qbank_id, question_id);

CREATE OR REPLACE FUNCTION public.pool_count(
  p_qbank_id     int,
  p_sources      text[] DEFAULT NULL,
  p_subject_ids  int[]  DEFAULT NULL,
  p_system_ids   int[]  DEFAULT NULL,
  p_topic_names  text[] DEFAULT NULL,
  p_scope        text   DEFAULT 'all'
) RETURNS int
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.questions q
  WHERE q.qbank_id = p_qbank_id
    AND (p_sources     IS NULL OR array_length(p_sources,1)     IS NULL OR q.source     = ANY(p_sources))
    AND (p_subject_ids IS NULL OR array_length(p_subject_ids,1) IS NULL OR q.subject_id = ANY(p_subject_ids))
    AND (p_system_ids  IS NULL OR array_length(p_system_ids,1)  IS NULL OR q.system_id  = ANY(p_system_ids))
    AND (p_topic_names IS NULL OR array_length(p_topic_names,1) IS NULL OR q.title      = ANY(p_topic_names))
    AND CASE p_scope
      WHEN 'all'       THEN TRUE
      WHEN 'unused'    THEN NOT EXISTS (SELECT 1 FROM public.attempts a  WHERE a.user_id = auth.uid() AND a.qbank_id = p_qbank_id AND a.question_id = q.id)
      WHEN 'correct'   THEN     EXISTS (SELECT 1 FROM public.attempts a  WHERE a.user_id = auth.uid() AND a.qbank_id = p_qbank_id AND a.question_id = q.id AND a.is_correct)
      WHEN 'incorrect' THEN     EXISTS (SELECT 1 FROM public.attempts a  WHERE a.user_id = auth.uid() AND a.qbank_id = p_qbank_id AND a.question_id = q.id AND a.is_correct = false AND a.selected_answer IS NOT NULL)
      WHEN 'omitted'   THEN     EXISTS (SELECT 1 FROM public.attempts a  WHERE a.user_id = auth.uid() AND a.qbank_id = p_qbank_id AND a.question_id = q.id AND a.selected_answer IS NULL)
      WHEN 'marked'    THEN     EXISTS (SELECT 1 FROM public.bookmarks b WHERE b.user_id = auth.uid() AND b.qbank_id = p_qbank_id AND b.question_id = q.id)
      ELSE TRUE
    END;
$$;

GRANT EXECUTE ON FUNCTION public.pool_count(int, text[], int[], int[], text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pick_question_ids(
  p_qbank_id     int,
  p_sources      text[] DEFAULT NULL,
  p_subject_ids  int[]  DEFAULT NULL,
  p_system_ids   int[]  DEFAULT NULL,
  p_topic_names  text[] DEFAULT NULL,
  p_scope        text   DEFAULT 'all',
  p_count        int    DEFAULT 20
) RETURNS int[]
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(id), ARRAY[]::int[])
  FROM (
    SELECT q.id
    FROM public.questions q
    WHERE q.qbank_id = p_qbank_id
      AND (p_sources     IS NULL OR array_length(p_sources,1)     IS NULL OR q.source     = ANY(p_sources))
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids,1) IS NULL OR q.subject_id = ANY(p_subject_ids))
      AND (p_system_ids  IS NULL OR array_length(p_system_ids,1)  IS NULL OR q.system_id  = ANY(p_system_ids))
      AND (p_topic_names IS NULL OR array_length(p_topic_names,1) IS NULL OR q.title      = ANY(p_topic_names))
      AND CASE p_scope
        WHEN 'all'       THEN TRUE
        WHEN 'unused'    THEN NOT EXISTS (SELECT 1 FROM public.attempts a  WHERE a.user_id = auth.uid() AND a.qbank_id = p_qbank_id AND a.question_id = q.id)
        WHEN 'correct'   THEN     EXISTS (SELECT 1 FROM public.attempts a  WHERE a.user_id = auth.uid() AND a.qbank_id = p_qbank_id AND a.question_id = q.id AND a.is_correct)
        WHEN 'incorrect' THEN     EXISTS (SELECT 1 FROM public.attempts a  WHERE a.user_id = auth.uid() AND a.qbank_id = p_qbank_id AND a.question_id = q.id AND a.is_correct = false AND a.selected_answer IS NOT NULL)
        WHEN 'omitted'   THEN     EXISTS (SELECT 1 FROM public.attempts a  WHERE a.user_id = auth.uid() AND a.qbank_id = p_qbank_id AND a.question_id = q.id AND a.selected_answer IS NULL)
        WHEN 'marked'    THEN     EXISTS (SELECT 1 FROM public.bookmarks b WHERE b.user_id = auth.uid() AND b.qbank_id = p_qbank_id AND b.question_id = q.id)
        ELSE TRUE
      END
    ORDER BY random()
    LIMIT GREATEST(p_count, 0)
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.pick_question_ids(int, text[], int[], int[], text[], text, int) TO authenticated;