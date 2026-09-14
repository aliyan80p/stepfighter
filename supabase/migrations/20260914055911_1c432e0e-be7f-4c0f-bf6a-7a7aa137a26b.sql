INSERT INTO public.admin_access (user_id, is_super, permissions)
SELECT r.user_id, true, ARRAY[]::text[]
FROM public.user_roles r
WHERE r.role = 'admin'
  AND NOT EXISTS (SELECT 1 FROM public.admin_access a WHERE a.user_id = r.user_id)
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_admin_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.admin_access (user_id, is_super, permissions)
    VALUES (NEW.user_id, true, ARRAY[]::text[])
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_admin_access_trigger ON public.user_roles;
CREATE TRIGGER ensure_admin_access_trigger
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.ensure_admin_access();