CREATE TABLE public.library_docs (
  id integer PRIMARY KEY,
  qbank_id integer NOT NULL DEFAULT 2,
  title text NOT NULL,
  path text,
  html text NOT NULL,
  plain text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.library_toc (
  id integer PRIMARY KEY,
  qbank_id integer NOT NULL DEFAULT 2,
  name text NOT NULL,
  doc_id integer,
  section text,
  parent_id integer,
  leaf integer
);

CREATE INDEX library_toc_parent_idx ON public.library_toc (qbank_id, parent_id);
CREATE INDEX library_toc_doc_idx ON public.library_toc (doc_id);

GRANT SELECT ON public.library_docs TO authenticated;
GRANT SELECT ON public.library_toc TO authenticated;
GRANT ALL ON public.library_docs TO service_role;
GRANT ALL ON public.library_toc TO service_role;

ALTER TABLE public.library_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_toc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entitled users can read library docs" ON public.library_docs
  FOR SELECT TO authenticated USING (app_private.has_qbank_access(auth.uid(), qbank_id::bigint));
CREATE POLICY "Entitled users can read library toc" ON public.library_toc
  FOR SELECT TO authenticated USING (app_private.has_qbank_access(auth.uid(), qbank_id::bigint));