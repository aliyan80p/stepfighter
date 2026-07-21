
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS medical_school TEXT,
  ADD COLUMN IF NOT EXISTS target_exam TEXT,
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS selected_qbanks TEXT[] DEFAULT ARRAY[]::TEXT[];

-- App roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins see all roles" ON public.user_roles;
CREATE POLICY "Admins see all roles" ON public.user_roles FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Entitlements
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','paid','expired')),
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  qbank_access TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  paid_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_entitlements TO authenticated;
GRANT ALL ON public.user_entitlements TO service_role;
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own entitlement" ON public.user_entitlements;
CREATE POLICY "Users read own entitlement" ON public.user_entitlements FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all entitlements" ON public.user_entitlements;
CREATE POLICY "Admins read all entitlements" ON public.user_entitlements FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Effective access helper: returns qbanks the user currently has access to
CREATE OR REPLACE FUNCTION public.effective_qbank_access(_user_id UUID)
RETURNS TEXT[] LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN e.plan = 'paid' AND (e.paid_until IS NULL OR e.paid_until > now()) THEN e.qbank_access
    WHEN e.plan = 'trial' AND e.trial_ends_at > now() THEN e.qbank_access
    ELSE ARRAY[]::TEXT[]
  END
  FROM public.user_entitlements e WHERE e.user_id = _user_id;
$$;

-- Handle new user: extend the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  qbanks TEXT[];
BEGIN
  -- Parse selected_qbanks from metadata (array of strings)
  IF jsonb_typeof(meta->'selected_qbanks') = 'array' THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(meta->'selected_qbanks')) INTO qbanks;
  ELSE
    qbanks := ARRAY[]::TEXT[];
  END IF;

  INSERT INTO public.profiles (id, display_name, full_name, country, medical_school, target_exam, target_date, selected_qbanks)
  VALUES (
    NEW.id,
    COALESCE(meta->>'display_name', meta->>'full_name', split_part(NEW.email,'@',1)),
    meta->>'full_name',
    meta->>'country',
    meta->>'medical_school',
    meta->>'target_exam',
    NULLIF(meta->>'target_date','')::DATE,
    qbanks
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    country = COALESCE(EXCLUDED.country, public.profiles.country),
    medical_school = COALESCE(EXCLUDED.medical_school, public.profiles.medical_school),
    target_exam = COALESCE(EXCLUDED.target_exam, public.profiles.target_exam),
    target_date = COALESCE(EXCLUDED.target_date, public.profiles.target_date),
    selected_qbanks = CASE WHEN array_length(EXCLUDED.selected_qbanks,1) > 0 THEN EXCLUDED.selected_qbanks ELSE public.profiles.selected_qbanks END;

  INSERT INTO public.user_entitlements (user_id, plan, trial_started_at, trial_ends_at, qbank_access)
  VALUES (NEW.id, 'trial', now(), now() + INTERVAL '14 days', qbanks)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grandfather all existing users as 'paid' with full access to all qbanks
INSERT INTO public.user_entitlements (user_id, plan, trial_started_at, trial_ends_at, qbank_access, paid_until)
SELECT u.id, 'paid', now(), now() + INTERVAL '14 days', ARRAY['step1','step2','step3'], now() + INTERVAL '10 years'
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- Grandfather profiles for existing users lacking a selected_qbanks value
UPDATE public.profiles SET selected_qbanks = ARRAY['step1','step2','step3']
WHERE selected_qbanks IS NULL OR array_length(selected_qbanks, 1) IS NULL;

-- Trigger updated_at on entitlements
DROP TRIGGER IF EXISTS trg_entitlements_updated ON public.user_entitlements;
CREATE TRIGGER trg_entitlements_updated BEFORE UPDATE ON public.user_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
