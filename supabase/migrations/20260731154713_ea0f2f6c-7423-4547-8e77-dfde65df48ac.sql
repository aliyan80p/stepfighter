CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  raw_qbanks TEXT[];
  qbanks TEXT[];
BEGIN
  IF jsonb_typeof(meta->'selected_qbanks') = 'array' THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(meta->'selected_qbanks')) INTO raw_qbanks;
  ELSE
    raw_qbanks := ARRAY[]::TEXT[];
  END IF;

  -- Signup metadata is fully client-controlled: keep only slugs that really
  -- exist and cap the trial at a single course, whatever the client sent.
  SELECT ARRAY(
    SELECT v FROM (
      SELECT DISTINCT ON (lower(btrim(x))) lower(btrim(x)) AS v
      FROM unnest(raw_qbanks) AS x
      WHERE EXISTS (SELECT 1 FROM public.qbanks q WHERE q.slug = lower(btrim(x)))
    ) s
    LIMIT 1
  ) INTO qbanks;

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
  VALUES (NEW.id, 'trial', now(), now() + INTERVAL '8 days', qbanks)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $function$;