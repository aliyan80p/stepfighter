GRANT EXECUTE ON FUNCTION public.has_qbank_access(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_qbank_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_count(integer, text[], integer[], integer[], text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pick_question_ids(integer, text[], integer[], integer[], text[], text, integer) TO authenticated;