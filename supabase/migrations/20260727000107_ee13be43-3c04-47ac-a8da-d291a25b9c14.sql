DROP POLICY IF EXISTS "Users can view own OTP metadata" ON public.login_otps;
REVOKE ALL ON public.login_otps FROM anon, authenticated;
GRANT ALL ON public.login_otps TO service_role;