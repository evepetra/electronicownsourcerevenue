GRANT SELECT ON public.councils TO anon;

CREATE POLICY "councils_public_read"
ON public.councils
FOR SELECT
TO anon
USING (true);