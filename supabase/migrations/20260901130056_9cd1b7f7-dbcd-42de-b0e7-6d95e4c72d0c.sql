CREATE OR REPLACE FUNCTION public.can_approve_council(_council_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'ADMIN')
      OR (
        public.has_role(auth.uid(), 'MAYOR')
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.council_id = _council_id
        )
      );
$$;

REVOKE EXECUTE ON FUNCTION public.can_approve_council(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_approve_council(uuid) TO authenticated;

DROP POLICY IF EXISTS cb_update ON public.council_budgets;
CREATE POLICY cb_update ON public.council_budgets
FOR UPDATE TO authenticated
USING (
  public.can_approve_council(council_id)
  OR (public.can_manage_council(council_id) AND approval_status <> 'APPROVED')
)
WITH CHECK (
  public.can_approve_council(council_id)
  OR (public.can_manage_council(council_id) AND approval_status IN ('DRAFT','SUBMITTED'))
);

DROP POLICY IF EXISTS cb_delete ON public.council_budgets;
CREATE POLICY cb_delete ON public.council_budgets
FOR DELETE TO authenticated
USING (public.can_manage_council(council_id) AND approval_status <> 'APPROVED');