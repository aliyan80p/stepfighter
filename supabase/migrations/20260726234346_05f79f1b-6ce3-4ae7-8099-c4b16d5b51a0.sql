CREATE TABLE IF NOT EXISTS public.media_backup_log (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  name TEXT NOT NULL,
  size BIGINT,
  drive_file_id TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bucket, name)
);

GRANT ALL ON public.media_backup_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.media_backup_log_id_seq TO service_role;
ALTER TABLE public.media_backup_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.list_media_objects(_bucket text, _limit integer DEFAULT 200)
RETURNS TABLE(name text, size bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.name, (o.metadata->>'size')::bigint AS size
  FROM storage.objects o
  LEFT JOIN public.media_backup_log l
    ON l.bucket = o.bucket_id AND l.name = o.name
  WHERE o.bucket_id = _bucket
    AND (l.id IS NULL OR l.size IS DISTINCT FROM (o.metadata->>'size')::bigint)
  ORDER BY o.name
  LIMIT GREATEST(_limit, 0);
$$;

REVOKE ALL ON FUNCTION public.list_media_objects(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_media_objects(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.media_backup_progress()
RETURNS TABLE(bucket text, total bigint, backed_up bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id::text,
         (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id),
         (SELECT count(*) FROM public.media_backup_log l WHERE l.bucket = b.id)
  FROM storage.buckets b
  WHERE b.id IN ('qbank-media','qbank-media-plain');
$$;

REVOKE ALL ON FUNCTION public.media_backup_progress() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.media_backup_progress() TO service_role;