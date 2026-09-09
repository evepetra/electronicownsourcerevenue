
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
      AND (
        _user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_council(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.can_approve_council(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.current_council_id() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.is_oversight() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.in_council(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.claim_role(app_role) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.set_audit_actor() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_council(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_approve_council(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_council_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_oversight() TO authenticated;
GRANT EXECUTE ON FUNCTION public.in_council(uuid) TO authenticated;
