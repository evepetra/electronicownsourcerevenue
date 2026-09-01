ALTER TABLE public.councils
  ADD COLUMN IF NOT EXISTS physical_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS postal_address text,
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS mayor text,
  ADD COLUMN IF NOT EXISTS town_clerk text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.councils SET
  physical_address = 'Plot 1 Bishop Street, Mukono Town, Mukono District',
  postal_address = 'P.O. Box 110, Mukono',
  phone = '+256 392 001 234',
  email = 'info@mukonomc.go.ug',
  website = 'https://www.mukonomc.go.ug',
  mayor = 'George Fredrick Kagimu',
  town_clerk = 'Sarah Nabirye'
WHERE code = 'MKO';

UPDATE public.councils SET
  physical_address = 'Town Hall, Main Street, Jinja City, Jinja District',
  postal_address = 'P.O. Box 720, Jinja',
  phone = '+256 434 121 090',
  email = 'info@jinjacity.go.ug',
  website = 'https://www.jinjacity.go.ug',
  mayor = 'Alton Peter Kasolo',
  town_clerk = 'Anthony Kintu'
WHERE code = 'JJA';

UPDATE public.councils SET
  physical_address = 'Plot 2 Kampala Road, Entebbe Municipality, Wakiso District',
  postal_address = 'P.O. Box 12, Entebbe',
  phone = '+256 414 320 145',
  email = 'info@entebbemc.go.ug',
  website = 'https://www.entebbemc.go.ug',
  mayor = 'Fabrice Rulinda',
  town_clerk = 'Joseph Ssemwanga'
WHERE code = 'EBB';

CREATE OR REPLACE FUNCTION public.can_manage_council(_council_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'ADMIN')
      OR (
        public.has_role(auth.uid(), 'COUNCIL_ADMIN')
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.council_id = _council_id
        )
      );
$$;

REVOKE ALL ON FUNCTION public.can_manage_council(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_council(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE POLICY councils_manage_update ON public.councils
  FOR UPDATE TO authenticated
  USING (public.can_manage_council(id))
  WITH CHECK (public.can_manage_council(id));

CREATE TABLE public.council_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id uuid NOT NULL REFERENCES public.councils(id) ON DELETE CASCADE,
  fiscal_year text NOT NULL,
  category text NOT NULL,
  allocated_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.council_budgets TO authenticated;
GRANT ALL ON public.council_budgets TO service_role;
ALTER TABLE public.council_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY cb_read ON public.council_budgets FOR SELECT TO authenticated USING (true);
CREATE POLICY cb_insert ON public.council_budgets FOR INSERT TO authenticated WITH CHECK (public.can_manage_council(council_id));
CREATE POLICY cb_update ON public.council_budgets FOR UPDATE TO authenticated USING (public.can_manage_council(council_id)) WITH CHECK (public.can_manage_council(council_id));
CREATE POLICY cb_delete ON public.council_budgets FOR DELETE TO authenticated USING (public.can_manage_council(council_id));

CREATE TABLE public.council_spending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id uuid NOT NULL REFERENCES public.councils(id) ON DELETE CASCADE,
  fiscal_year text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  spent_on date NOT NULL DEFAULT CURRENT_DATE,
  department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.council_spending TO authenticated;
GRANT ALL ON public.council_spending TO service_role;
ALTER TABLE public.council_spending ENABLE ROW LEVEL SECURITY;
CREATE POLICY cs_read ON public.council_spending FOR SELECT TO authenticated USING (true);
CREATE POLICY cs_insert ON public.council_spending FOR INSERT TO authenticated WITH CHECK (public.can_manage_council(council_id));
CREATE POLICY cs_update ON public.council_spending FOR UPDATE TO authenticated USING (public.can_manage_council(council_id)) WITH CHECK (public.can_manage_council(council_id));
CREATE POLICY cs_delete ON public.council_spending FOR DELETE TO authenticated USING (public.can_manage_council(council_id));

CREATE TABLE public.council_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id uuid NOT NULL REFERENCES public.councils(id) ON DELETE CASCADE,
  title text NOT NULL,
  agenda text,
  meeting_at timestamptz NOT NULL,
  location text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'SCHEDULED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.council_meetings TO authenticated;
GRANT ALL ON public.council_meetings TO service_role;
ALTER TABLE public.council_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY cm_read ON public.council_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY cm_insert ON public.council_meetings FOR INSERT TO authenticated WITH CHECK (public.can_manage_council(council_id));
CREATE POLICY cm_update ON public.council_meetings FOR UPDATE TO authenticated USING (public.can_manage_council(council_id)) WITH CHECK (public.can_manage_council(council_id));
CREATE POLICY cm_delete ON public.council_meetings FOR DELETE TO authenticated USING (public.can_manage_council(council_id));

CREATE TRIGGER council_budgets_updated_at BEFORE UPDATE ON public.council_budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER council_spending_updated_at BEFORE UPDATE ON public.council_spending FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER council_meetings_updated_at BEFORE UPDATE ON public.council_meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.council_budgets (council_id, fiscal_year, category, allocated_amount, notes)
SELECT c.id, '2026/27', v.category, v.amount, v.notes
FROM public.councils c
CROSS JOIN (VALUES
  ('Roads & Infrastructure', 1850000000, 'Tarmacking and drainage works'),
  ('Health Services', 940000000, 'Health centre operations and drugs'),
  ('Education', 1260000000, 'Primary school grants and inspection'),
  ('Revenue Administration', 380000000, 'Collection, enforcement and ICT')
) AS v(category, amount, notes)
WHERE c.code IN ('MKO','JJA','EBB');

INSERT INTO public.council_spending (council_id, fiscal_year, category, description, amount, spent_on, department)
SELECT c.id, '2026/27', v.category, v.description, v.amount, v.spent_on::date, v.department
FROM public.councils c
CROSS JOIN (VALUES
  ('Roads & Infrastructure', 'Q1 road grading contract', 420000000, '2026-08-14', 'Works'),
  ('Health Services', 'Medical supplies procurement', 165000000, '2026-08-03', 'Health'),
  ('Education', 'School inspection and capitation', 310000000, '2026-07-28', 'Education'),
  ('Revenue Administration', 'POS devices and airtime for collection', 74000000, '2026-08-20', 'Finance')
) AS v(category, description, amount, spent_on, department)
WHERE c.code IN ('MKO','JJA','EBB');

INSERT INTO public.council_meetings (council_id, title, agenda, meeting_at, location, status)
SELECT c.id, v.title, v.agenda, v.meeting_at::timestamptz, v.location, 'SCHEDULED'
FROM public.councils c
CROSS JOIN (VALUES
  ('Finance Committee Sitting', 'Review of Q1 own source revenue performance', '2026-09-10 10:00+03', 'Council Boardroom'),
  ('Full Council Session', 'Approval of supplementary budget', '2026-09-24 09:30+03', 'Council Hall'),
  ('Public Budget Hearing', 'Citizen input on 2026/27 spending priorities', '2026-10-08 14:00+03', 'Community Hall')
) AS v(title, agenda, meeting_at, location)
WHERE c.code IN ('MKO','JJA','EBB');