REVOKE EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION app_private.has_qbank_access(uuid, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION app_private.effective_qbank_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.has_qbank_access(uuid, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.effective_qbank_access(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pool_count(integer, text[], integer[], integer[], text[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pick_question_ids(integer, text[], integer[], integer[], text[], text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_count(integer, text[], integer[], integer[], text[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pick_question_ids(integer, text[], integer[], integer[], text[], text, integer) TO authenticated, service_role;