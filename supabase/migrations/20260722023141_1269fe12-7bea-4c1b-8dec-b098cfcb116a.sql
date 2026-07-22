
-- 1) Helper: does the user have active entitlement for this qbank?
CREATE OR REPLACE FUNCTION public.has_qbank_access(_user_id uuid, _qbank_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_entitlements e
    WHERE e.user_id = _user_id
      AND _qbank_id::text = ANY(e.qbank_access)
      AND (
        (e.plan = 'paid' AND (e.paid_until IS NULL OR e.paid_until > now()))
        OR (e.plan = 'trial' AND e.trial_ends_at > now())
      )
  )
  OR public.has_role(_user_id, 'admin');
$$;

REVOKE EXECUTE ON FUNCTION public.has_qbank_access(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_qbank_access(uuid, bigint) TO service_role;

-- 2) Lock down effective_qbank_access from direct end-user execution
REVOKE EXECUTE ON FUNCTION public.effective_qbank_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_qbank_access(uuid) TO service_role;

-- 3) Replace permissive SELECT policies with entitlement-gated ones
DROP POLICY IF EXISTS "Authenticated can read questions" ON public.questions;
CREATE POLICY "Entitled users can read questions" ON public.questions
  FOR SELECT TO authenticated
  USING (public.has_qbank_access(auth.uid(), qbank_id));

DROP POLICY IF EXISTS "Authenticated can read answers" ON public.answers;
CREATE POLICY "Entitled users can read answers" ON public.answers
  FOR SELECT TO authenticated
  USING (public.has_qbank_access(auth.uid(), qbank_id));

DROP POLICY IF EXISTS "Authenticated can read refs" ON public.refs;
CREATE POLICY "Entitled users can read refs" ON public.refs
  FOR SELECT TO authenticated
  USING (public.has_qbank_access(auth.uid(), qbank_id));

DROP POLICY IF EXISTS "Subjects are readable by everyone" ON public.subjects;
CREATE POLICY "Entitled users can read subjects" ON public.subjects
  FOR SELECT TO authenticated
  USING (public.has_qbank_access(auth.uid(), qbank_id));

DROP POLICY IF EXISTS "Systems are readable by everyone" ON public.systems;
CREATE POLICY "Entitled users can read systems" ON public.systems
  FOR SELECT TO authenticated
  USING (public.has_qbank_access(auth.uid(), qbank_id));

DROP POLICY IF EXISTS "authenticated_read_qbank_media" ON public.qbank_media;
CREATE POLICY "Entitled users can read qbank_media" ON public.qbank_media
  FOR SELECT TO authenticated
  USING (public.has_qbank_access(auth.uid(), qbank_id));

-- Also allow the has_qbank_access helper to be evaluated inside RLS policies
GRANT EXECUTE ON FUNCTION public.has_qbank_access(uuid, bigint) TO authenticated;

-- 4) Lock down the storage bucket to service role only (media is streamed via signed server route)
DROP POLICY IF EXISTS "Authenticated read qbank-media" ON storage.objects;
