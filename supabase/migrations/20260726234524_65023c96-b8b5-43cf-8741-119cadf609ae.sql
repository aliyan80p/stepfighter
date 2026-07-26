SELECT cron.schedule(
  'stepfighter-media-backup',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--86d2c04e-6f58-43c2-b1b5-8b6ad3ba007f.lovable.app/api/public/hooks/media-backup',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_UnRS_1AoeRo9c_rWLUr2EA_XKlvqeBD"}'::jsonb,
    body:='{"batch": 120}'::jsonb,
    timeout_milliseconds:=280000
  );
  $$
);