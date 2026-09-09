
DROP VIEW IF EXISTS public.councils_public;

CREATE OR REPLACE FUNCTION public.list_councils_public()
RETURNS TABLE (id uuid, name text, code text, district text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.id, c.name, c.code, c.district FROM public.councils c ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION public.list_councils_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_councils_public() TO anon;
