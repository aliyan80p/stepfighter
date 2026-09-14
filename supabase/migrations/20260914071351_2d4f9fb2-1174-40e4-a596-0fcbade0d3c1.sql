CREATE TABLE IF NOT EXISTS public.content_changes (
  id bigserial PRIMARY KEY,
  entity text NOT NULL,
  qbank_id integer,
  ref_id bigint,
  ref_key text,
  action text NOT NULL DEFAULT 'upsert',
  label text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  published_by uuid
);

CREATE INDEX IF NOT EXISTS content_changes_pending_idx
  ON public.content_changes (published_at, changed_at DESC);

GRANT SELECT ON public.content_changes TO authenticated;
GRANT ALL ON public.content_changes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.content_changes_id_seq TO service_role;

ALTER TABLE public.content_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publishers can view content changes" ON public.content_changes;
CREATE POLICY "Publishers can view content changes"
  ON public.content_changes FOR SELECT TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'publish'));