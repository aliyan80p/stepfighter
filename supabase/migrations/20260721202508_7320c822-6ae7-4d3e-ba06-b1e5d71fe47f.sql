
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.effective_qbank_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_qbank_access(UUID) TO authenticated, service_role;
