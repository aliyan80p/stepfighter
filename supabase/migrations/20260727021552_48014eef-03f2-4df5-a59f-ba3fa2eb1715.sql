DO $$
DECLARE i int;
BEGIN
  FOR i IN 0..31 LOOP
    BEGIN PERFORM cron.unschedule('stepfighter-media-backup-s'||i); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  FOR i IN 0..1 LOOP
    PERFORM cron.schedule(
      'stepfighter-media-backup-s'||i,
      '* * * * *',
      format($f$select net.http_post(
        url:='https://project--86d2c04e-6f58-43c2-b1b5-8b6ad3ba007f.lovable.app/api/public/hooks/media-backup',
        headers:='{"Content-Type":"application/json","apikey":"sb_publishable_UnRS_1AoeRo9c_rWLUr2EA_XKlvqeBD"}'::jsonb,
        body:='{"batch":50,"shard":%s,"shards":2}'::jsonb,
        timeout_milliseconds:=55000);$f$, i)
    );
  END LOOP;
END $$;