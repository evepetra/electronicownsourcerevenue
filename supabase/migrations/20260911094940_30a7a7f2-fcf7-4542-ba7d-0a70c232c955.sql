
CREATE OR REPLACE VIEW public.councils_public
WITH (security_invoker = on) AS
  SELECT id, name, code, district FROM public.councils;

GRANT SELECT ON public.councils_public TO anon, authenticated;

-- anon may read councils, but only the non-sensitive columns
GRANT SELECT (id, name, code, district) ON public.councils TO anon;

CREATE POLICY "councils_public_read" ON public.councils
  FOR SELECT TO anon USING (true);
