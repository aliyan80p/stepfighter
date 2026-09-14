CREATE TABLE public.content_drafts (
  id bigserial PRIMARY KEY,
  entity text NOT NULL,
  qbank_id integer,
  ref_id bigint,
  ref_key text,
  label text,
  payload jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  applied_by uuid,
  discarded_at timestamptz
);
CREATE INDEX content_drafts_pending_idx ON public.content_drafts (applied_at, discarded_at, created_at DESC);
GRANT SELECT ON public.content_drafts TO authenticated;
GRANT ALL ON public.content_drafts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.content_drafts_id_seq TO service_role;
ALTER TABLE public.content_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publishers can view content drafts"
  ON public.content_drafts FOR SELECT TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'publish'));