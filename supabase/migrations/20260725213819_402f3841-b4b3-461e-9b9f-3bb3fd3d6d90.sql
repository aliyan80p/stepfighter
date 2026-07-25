DROP POLICY IF EXISTS "Users manage own OTPs" ON public.login_otps;
CREATE POLICY "Users can view own OTP metadata" ON public.login_otps FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.login_otps FROM authenticated, anon;

CREATE POLICY "internal_config_no_client_access" ON public.internal_config FOR SELECT TO authenticated, anon USING (false);