
DROP FUNCTION IF EXISTS public.list_councils_public();

GRANT SELECT (id, name, code, district) ON public.councils TO anon;
CREATE POLICY councils_public_read ON public.councils FOR SELECT TO anon USING (true);
