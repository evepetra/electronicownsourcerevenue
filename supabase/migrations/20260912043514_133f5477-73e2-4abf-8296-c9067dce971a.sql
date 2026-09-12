-- Remove the anonymous SELECT policy on the base table so phone, email,
-- addresses and officials are no longer readable by unauthenticated users.
DROP POLICY IF EXISTS councils_public_read ON public.councils;

-- Ensure anon has no direct privileges on the base table.
REVOKE ALL ON public.councils FROM anon;

-- Recreate the limited public listing view (non-sensitive columns only) and
-- grant read on it to anonymous users for the council picker.
CREATE OR REPLACE VIEW public.councils_public
WITH (security_invoker = false) AS
SELECT id, name, code, district FROM public.councils;

GRANT SELECT ON public.councils_public TO anon;
GRANT SELECT ON public.councils_public TO authenticated;
GRANT ALL ON public.councils_public TO service_role;