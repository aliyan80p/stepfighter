
CREATE TABLE public.qbank_media (
  qbank_id INTEGER NOT NULL REFERENCES public.qbanks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (qbank_id, name)
);
GRANT SELECT ON public.qbank_media TO authenticated;
GRANT ALL ON public.qbank_media TO service_role;
ALTER TABLE public.qbank_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_qbank_media" ON public.qbank_media
  FOR SELECT TO authenticated USING (true);
CREATE INDEX qbank_media_name_idx ON public.qbank_media (lower(name));
