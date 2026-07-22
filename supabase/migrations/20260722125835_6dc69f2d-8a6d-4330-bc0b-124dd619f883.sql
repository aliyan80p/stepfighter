
CREATE TABLE public.login_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX login_otps_user_created_idx ON public.login_otps (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_otps TO authenticated;
GRANT ALL ON public.login_otps TO service_role;
ALTER TABLE public.login_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own OTPs" ON public.login_otps FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mfa_verified_until TIMESTAMPTZ;
