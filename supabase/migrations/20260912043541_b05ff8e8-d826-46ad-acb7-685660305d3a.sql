-- Drop the security-definer view flagged by the linter.
DROP VIEW IF EXISTS public.councils_public;

-- Sanctioned alternative: a SECURITY DEFINER function with a fixed search_path
-- that exposes only the non-sensitive columns needed by the public council picker.
CREATE OR REPLACE FUNCTION public.list_public_councils()
RETURNS TABLE(id uuid, name text, code text, district text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.code, c.district
  FROM public.councils c
  ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION public.list_public_councils() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_councils() TO anon, authenticated;