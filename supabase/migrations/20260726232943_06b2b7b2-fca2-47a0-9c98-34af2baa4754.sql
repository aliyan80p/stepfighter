CREATE OR REPLACE FUNCTION public.export_auth_snapshot(p_table text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_table = 'users' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at, t.id), '[]'::jsonb) INTO result
    FROM (SELECT * FROM auth.users ORDER BY created_at, id OFFSET p_offset LIMIT p_limit) t;
  ELSIF p_table = 'identities' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) INTO result
    FROM (SELECT * FROM auth.identities ORDER BY id OFFSET p_offset LIMIT p_limit) t;
  ELSIF p_table = 'mfa_factors' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) INTO result
    FROM (SELECT * FROM auth.mfa_factors ORDER BY id OFFSET p_offset LIMIT p_limit) t;
  ELSE
    RAISE EXCEPTION 'unsupported table %', p_table;
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.export_auth_snapshot(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.export_auth_snapshot(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.export_auth_snapshot(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.export_auth_snapshot(text, integer, integer) TO service_role;