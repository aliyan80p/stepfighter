DO $$
DECLARE url text; key text; i int;
BEGIN
  SELECT decrypted_secret INTO url FROM vault.decrypted_secrets WHERE name='SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO key FROM vault.decrypted_secrets WHERE name='SUPABASE_PUBLISHABLE_KEY' LIMIT 1;
  FOR i IN 0..1 LOOP
    PERFORM cron.schedule(
      'stepfighter-media-backup-s'||i,
      '*/2 * * * *',
      format($f$select net.http_post(
        url:='https://project--86d2c04e-6f58-43c2-b1b5-8b6ad3ba007f.lovable.app/api/public/hooks/media-backup',
        headers:=jsonb_build_object('Content-Type','application/json','apikey',%L),
        body:=jsonb_build_object('batch',60,'shard',%s,'shards',2),
        timeout_milliseconds:=110000);$f$, key, i)
    );
  END LOOP;
END $$;