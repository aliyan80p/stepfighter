-- Disaster-recovery standby: permissions that a schema/data copy does NOT bring over.
-- Run this once against YOUR OWN Supabase (mirror) database. Never against live.
--
-- Symptom it fixes: "test cannot be created" — inserting into public.tests fails with
--   permission denied for sequence tests_id_seq
-- because table GRANTs were copied but sequence GRANTs were not.

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- Helper functions used by entitlement checks
GRANT EXECUTE ON FUNCTION public.has_qbank_access(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_qbank_access(uuid) TO authenticated;
