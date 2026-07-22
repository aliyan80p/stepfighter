
CREATE OR REPLACE FUNCTION public.has_qbank_access(_user_id uuid, _qbank_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  OR public.has_role(_user_id, 'admin');
$function$;

CREATE OR REPLACE FUNCTION public.effective_qbank_access(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN e.plan = 'paid' AND (e.paid_until IS NULL OR e.paid_until > now()) THEN e.qbank_access
    WHEN e.plan = 'trial' AND e.trial_ends_at > now() THEN e.qbank_access
    ELSE ARRAY[]::TEXT[]
  END
  FROM public.user_entitlements e WHERE e.user_id = _user_id;
$function$;
