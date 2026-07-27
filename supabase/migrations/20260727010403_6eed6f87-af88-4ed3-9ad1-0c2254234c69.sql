CREATE OR REPLACE FUNCTION public.media_backup_progress()
 RETURNS TABLE(bucket text, total bigint, backed_up bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.id::text,
         (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id),
         (SELECT count(*) FROM public.media_backup_log l WHERE l.bucket = b.id)
  FROM storage.buckets b
  WHERE b.id IN ('qbank-media-plain');
$function$;