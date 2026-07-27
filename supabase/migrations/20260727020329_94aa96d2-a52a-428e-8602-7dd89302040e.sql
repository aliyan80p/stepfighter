DO $$
DECLARE j record; url text; key text;
BEGIN
  SELECT decrypted_secret INTO url FROM vault.decrypted_secrets WHERE name='SUPABASE_URL' LIMIT 1;
  FOR j IN SELECT jobname FROM cron.job WHERE jobname LIKE 'stepfighter-media-backup-%' LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;