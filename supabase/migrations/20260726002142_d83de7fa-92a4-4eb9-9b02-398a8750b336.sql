CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION app_private.has_qbank_access(_user_id uuid, _qbank_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_entitlements e
    JOIN public.qbanks q ON q.id = _qbank_id
    WHERE e.user_id = _user_id
      AND (
        q.slug = ANY(e.qbank_access)
        OR _qbank_id::text = ANY(e.qbank_access)
      )
      AND (
        (e.plan = 'paid' AND (e.paid_until IS NULL OR e.paid_until > now()))
        OR (e.plan = 'trial' AND e.trial_ends_at > now())
      )
  )
  OR app_private.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION app_private.effective_qbank_access(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN e.plan = 'paid' AND (e.paid_until IS NULL OR e.paid_until > now()) THEN e.qbank_access
      WHEN e.plan = 'trial' AND e.trial_ends_at > now() THEN e.qbank_access
      ELSE ARRAY[]::text[]
    END
    FROM public.user_entitlements e
    WHERE e.user_id = _user_id
  ), ARRAY[]::text[]);
$$;

GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.has_qbank_access(uuid, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.effective_qbank_access(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    );
$$;

REVOKE EXECUTE ON FUNCTION public.has_qbank_access(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.effective_qbank_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_qbank_access(uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.effective_qbank_access(uuid) TO service_role;

DROP POLICY IF EXISTS "Entitled users can read questions" ON public.questions;
CREATE POLICY "Entitled users can read questions"
ON public.questions
FOR SELECT
TO authenticated
USING (app_private.has_qbank_access(auth.uid(), qbank_id::bigint));

DROP POLICY IF EXISTS "Entitled users can read answers" ON public.answers;
CREATE POLICY "Entitled users can read answers"
ON public.answers
FOR SELECT
TO authenticated
USING (app_private.has_qbank_access(auth.uid(), qbank_id::bigint));

DROP POLICY IF EXISTS "Entitled users can read refs" ON public.refs;
CREATE POLICY "Entitled users can read refs"
ON public.refs
FOR SELECT
TO authenticated
USING (app_private.has_qbank_access(auth.uid(), qbank_id::bigint));

DROP POLICY IF EXISTS "Entitled users can read qbank_media" ON public.qbank_media;
CREATE POLICY "Entitled users can read qbank_media"
ON public.qbank_media
FOR SELECT
TO authenticated
USING (app_private.has_qbank_access(auth.uid(), qbank_id::bigint));

DROP POLICY IF EXISTS "Entitled users can read subjects" ON public.subjects;
CREATE POLICY "Entitled users can read subjects"
ON public.subjects
FOR SELECT
TO authenticated
USING (app_private.has_qbank_access(auth.uid(), qbank_id::bigint));

DROP POLICY IF EXISTS "Entitled users can read systems" ON public.systems;
CREATE POLICY "Entitled users can read systems"
ON public.systems
FOR SELECT
TO authenticated
USING (app_private.has_qbank_access(auth.uid(), qbank_id::bigint));

DROP POLICY IF EXISTS "Admins see all roles" ON public.user_roles;
CREATE POLICY "Admins see all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read all entitlements" ON public.user_entitlements;
CREATE POLICY "Admins read all entitlements"
ON public.user_entitlements
FOR SELECT
TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'));
