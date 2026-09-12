-- Drop the definer function approach.
DROP FUNCTION IF EXISTS public.list_public_councils();

-- Column-level privileges: anonymous users may read only the non-sensitive
-- columns of the councils table; all other columns remain inaccessible.
REVOKE ALL ON public.councils FROM anon;
GRANT SELECT (id, name, code, district) ON public.councils TO anon;

-- Row policy for anonymous reads (rows are fine to list; columns are restricted above).
CREATE POLICY councils_public_read
ON public.councils
FOR SELECT
TO anon
USING (true);