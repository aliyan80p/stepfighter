CREATE TABLE public.admin_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_super boolean NOT NULL DEFAULT false,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_access TO authenticated;
GRANT ALL ON public.admin_access TO service_role;

ALTER TABLE public.admin_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read their own access" ON public.admin_access
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_admin_access_updated_at
  BEFORE UPDATE ON public.admin_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_access WHERE user_id = _user_id AND is_super)
$$;

CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_access a
    WHERE a.user_id = _user_id
      AND (a.is_super OR _permission = ANY(a.permissions))
  ) AND EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role = 'admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(uuid, text) TO authenticated;

INSERT INTO public.admin_access (user_id, is_super, permissions)
SELECT user_id, true, '{}'
FROM public.user_roles WHERE role = 'admin'
ON CONFLICT (user_id) DO UPDATE SET is_super = true;