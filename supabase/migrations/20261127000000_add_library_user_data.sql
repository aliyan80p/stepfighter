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
  ON public.library_user_data FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own library data" ON public.library_user_data;
CREATE POLICY "Users can insert own library data"
  ON public.library_user_data FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own library data" ON public.library_user_data;
CREATE POLICY "Users can update own library data"
  ON public.library_user_data FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own library data" ON public.library_user_data;
CREATE POLICY "Users can delete own library data"
  ON public.library_user_data FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
