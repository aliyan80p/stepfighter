INSERT INTO public.internal_config (key, value)
VALUES ('hook_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;