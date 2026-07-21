UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'agent1784676527@stepfighter.test';
INSERT INTO public.user_entitlements (user_id, plan, paid_until, qbank_access)
SELECT id, 'paid', now() + interval '7 days', ARRAY['step1','step2ck','step3']
FROM auth.users WHERE email = 'agent1784676527@stepfighter.test'
ON CONFLICT (user_id) DO UPDATE SET plan='paid', paid_until=now()+interval '7 days', qbank_access=ARRAY['step1','step2ck','step3'];