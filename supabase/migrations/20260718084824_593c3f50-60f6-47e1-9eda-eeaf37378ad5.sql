
CREATE TABLE public.qbanks (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qbanks TO authenticated;
GRANT ALL ON public.qbanks TO service_role;
ALTER TABLE public.qbanks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read qbanks" ON public.qbanks FOR SELECT TO authenticated USING (true);

INSERT INTO public.qbanks (slug, name, description) VALUES
  ('step2', 'USMLE Step 2', 'UWorld Step 2 CK question bank'),
  ('step1', 'USMLE Step 1', 'UWorld Step 1 question bank');

ALTER TABLE public.questions  ADD COLUMN qbank_id INTEGER REFERENCES public.qbanks(id);
ALTER TABLE public.subjects   ADD COLUMN qbank_id INTEGER REFERENCES public.qbanks(id);
ALTER TABLE public.systems    ADD COLUMN qbank_id INTEGER REFERENCES public.qbanks(id);
ALTER TABLE public.tests      ADD COLUMN qbank_id INTEGER REFERENCES public.qbanks(id);
ALTER TABLE public.attempts   ADD COLUMN qbank_id INTEGER REFERENCES public.qbanks(id);
ALTER TABLE public.bookmarks  ADD COLUMN qbank_id INTEGER REFERENCES public.qbanks(id);
ALTER TABLE public.answers    ADD COLUMN qbank_id INTEGER REFERENCES public.qbanks(id);
ALTER TABLE public.refs       ADD COLUMN qbank_id INTEGER REFERENCES public.qbanks(id);

UPDATE public.questions  SET qbank_id = (SELECT id FROM public.qbanks WHERE slug='step2') WHERE qbank_id IS NULL;
UPDATE public.subjects   SET qbank_id = (SELECT id FROM public.qbanks WHERE slug='step2') WHERE qbank_id IS NULL;
UPDATE public.systems    SET qbank_id = (SELECT id FROM public.qbanks WHERE slug='step2') WHERE qbank_id IS NULL;
UPDATE public.tests      SET qbank_id = (SELECT id FROM public.qbanks WHERE slug='step2') WHERE qbank_id IS NULL;
UPDATE public.attempts   SET qbank_id = (SELECT id FROM public.qbanks WHERE slug='step2') WHERE qbank_id IS NULL;
UPDATE public.bookmarks  SET qbank_id = (SELECT id FROM public.qbanks WHERE slug='step2') WHERE qbank_id IS NULL;
UPDATE public.answers    SET qbank_id = (SELECT id FROM public.qbanks WHERE slug='step2') WHERE qbank_id IS NULL;
UPDATE public.refs       SET qbank_id = (SELECT id FROM public.qbanks WHERE slug='step2') WHERE qbank_id IS NULL;

ALTER TABLE public.questions ALTER COLUMN qbank_id SET NOT NULL;
ALTER TABLE public.subjects  ALTER COLUMN qbank_id SET NOT NULL;
ALTER TABLE public.systems   ALTER COLUMN qbank_id SET NOT NULL;
ALTER TABLE public.tests     ALTER COLUMN qbank_id SET NOT NULL;
ALTER TABLE public.attempts  ALTER COLUMN qbank_id SET NOT NULL;
ALTER TABLE public.bookmarks ALTER COLUMN qbank_id SET NOT NULL;
ALTER TABLE public.answers   ALTER COLUMN qbank_id SET NOT NULL;
ALTER TABLE public.refs      ALTER COLUMN qbank_id SET NOT NULL;

-- Drop all FKs depending on the PKs we're re-keying
ALTER TABLE public.answers    DROP CONSTRAINT IF EXISTS answers_question_id_fkey;
ALTER TABLE public.refs       DROP CONSTRAINT IF EXISTS refs_question_id_fkey;
ALTER TABLE public.attempts   DROP CONSTRAINT IF EXISTS attempts_question_id_fkey;
ALTER TABLE public.bookmarks  DROP CONSTRAINT IF EXISTS bookmarks_question_id_fkey;
ALTER TABLE public.questions  DROP CONSTRAINT IF EXISTS questions_subject_id_fkey;
ALTER TABLE public.questions  DROP CONSTRAINT IF EXISTS questions_system_id_fkey;

-- Re-key parent tables
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_pkey;
ALTER TABLE public.questions ADD CONSTRAINT questions_pkey PRIMARY KEY (qbank_id, id);
ALTER TABLE public.subjects  DROP CONSTRAINT IF EXISTS subjects_pkey;
ALTER TABLE public.subjects  ADD CONSTRAINT subjects_pkey PRIMARY KEY (qbank_id, id);
ALTER TABLE public.systems   DROP CONSTRAINT IF EXISTS systems_pkey;
ALTER TABLE public.systems   ADD CONSTRAINT systems_pkey PRIMARY KEY (qbank_id, id);

-- Re-add composite FKs (keep subject/system FKs optional since original data may have nulls)
ALTER TABLE public.answers   ADD CONSTRAINT answers_question_fkey   FOREIGN KEY (qbank_id, question_id) REFERENCES public.questions(qbank_id, id) ON DELETE CASCADE;
ALTER TABLE public.refs      ADD CONSTRAINT refs_question_fkey      FOREIGN KEY (qbank_id, question_id) REFERENCES public.questions(qbank_id, id) ON DELETE CASCADE;
ALTER TABLE public.attempts  ADD CONSTRAINT attempts_question_fkey  FOREIGN KEY (qbank_id, question_id) REFERENCES public.questions(qbank_id, id) ON DELETE CASCADE;
ALTER TABLE public.bookmarks ADD CONSTRAINT bookmarks_question_fkey FOREIGN KEY (qbank_id, question_id) REFERENCES public.questions(qbank_id, id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_questions_qbank ON public.questions(qbank_id);
CREATE INDEX IF NOT EXISTS idx_attempts_qbank_user ON public.attempts(qbank_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tests_qbank_user ON public.tests(qbank_id, user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_qbank_user ON public.bookmarks(qbank_id, user_id);
