
ALTER TABLE public.qbank_media
  ADD COLUMN IF NOT EXISTS plain_url TEXT,
  ADD COLUMN IF NOT EXISTS plain_url_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_qbank_media_qbank_name ON public.qbank_media(qbank_id, name);
