CREATE TABLE IF NOT EXISTS public.library_user_data (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_id integer NOT NULL,
  doc_title text NOT NULL DEFAULT '',
  bookmarked boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_library_user_data_bookmarked
  ON public.library_user_data (user_id, updated_at DESC)
  WHERE bookmarked = true;

ALTER TABLE public.library_user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own library data" ON public.library_user_data;
CREATE POLICY "Users can view own library data"
  ON public.library_user_data FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own library data" ON public.library_user_data;
CREATE POLICY "Users can insert own library data"
  ON public.library_user_data FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own library data" ON public.library_user_data;
CREATE POLICY "Users can update own library data"
  ON public.library_user_data FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own library data" ON public.library_user_data;
CREATE POLICY "Users can delete own library data"
  ON public.library_user_data FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.question_highlights (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qbank_id integer NOT NULL,
  question_id integer NOT NULL,
  highlights jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, qbank_id, question_id)
);

ALTER TABLE public.question_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own question highlights" ON public.question_highlights;
CREATE POLICY "Users can view own question highlights"
  ON public.question_highlights FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own question highlights" ON public.question_highlights;
CREATE POLICY "Users can insert own question highlights"
  ON public.question_highlights FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own question highlights" ON public.question_highlights;
CREATE POLICY "Users can update own question highlights"
  ON public.question_highlights FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own question highlights" ON public.question_highlights;
CREATE POLICY "Users can delete own question highlights"
  ON public.question_highlights FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_refs_qbank_type_title
  ON public.refs (qbank_id, ref_type, lower(ref_title));
