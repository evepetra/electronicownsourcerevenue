-- ENUM
CREATE TYPE public.app_role AS ENUM ('ADMIN','REVENUE_OFFICER','CASHIER','AUDITOR');

-- COUNCILS
CREATE TABLE public.councils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  district text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.councils TO authenticated;
GRANT ALL ON public.councils TO service_role;
ALTER TABLE public.councils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "councils_read" ON public.councils FOR SELECT TO authenticated USING (true);

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT 'Staff Member',
  staff_id text NOT NULL DEFAULT to_char(now(),'YYYY') || '-OSR',
  council_id uuid REFERENCES public.councils(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "roles_read" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN')) WITH CHECK (public.has_role(auth.uid(),'ADMIN'));

-- Bootstrap: first registered staff becomes ADMIN, others get the requested non-admin role.
CREATE OR REPLACE FUNCTION public.claim_role(_role public.app_role)
RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE granted public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT role INTO granted FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  IF granted IS NOT NULL THEN RETURN granted; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'ADMIN') THEN
    granted := 'ADMIN';
  ELSIF _role = 'ADMIN' THEN
    granted := 'REVENUE_OFFICER';
  ELSE
    granted := _role;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), granted)
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN granted;
END;
$$;

-- TAXPAYERS
CREATE TABLE public.taxpayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxpayer_code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'BUSINESS',
  nin text, tin text,
  phone text NOT NULL DEFAULT '',
  email text, address text, location text,
  council_id uuid NOT NULL REFERENCES public.councils(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.taxpayers TO authenticated;
GRANT ALL ON public.taxpayers TO service_role;
ALTER TABLE public.taxpayers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taxpayers_read" ON public.taxpayers FOR SELECT TO authenticated USING (true);
CREATE POLICY "taxpayers_insert" ON public.taxpayers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "taxpayers_update" ON public.taxpayers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- PREMISES
CREATE TABLE public.premises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'MARKET_STALL',
  market text, ward text,
  taxpayer_id uuid NOT NULL REFERENCES public.taxpayers(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.premises TO authenticated;
GRANT ALL ON public.premises TO service_role;
ALTER TABLE public.premises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "premises_read" ON public.premises FOR SELECT TO authenticated USING (true);
CREATE POLICY "premises_insert" ON public.premises FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "premises_update" ON public.premises FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- FEE SCHEDULES
CREATE TABLE public.fee_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id uuid NOT NULL REFERENCES public.councils(id),
  revenue_source text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  period text NOT NULL DEFAULT 'MONTHLY',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_schedules TO authenticated;
GRANT ALL ON public.fee_schedules TO service_role;
ALTER TABLE public.fee_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fees_read" ON public.fee_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "fees_insert" ON public.fee_schedules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fees_admin_update" ON public.fee_schedules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'ADMIN')) WITH CHECK (public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "fees_admin_delete" ON public.fee_schedules FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'ADMIN'));

-- ASSESSMENTS
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  premise_id uuid NOT NULL REFERENCES public.premises(id) ON DELETE CASCADE,
  fee_schedule_id uuid NOT NULL REFERENCES public.fee_schedules(id),
  amount numeric NOT NULL,
  due_date date NOT NULL,
  period text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assessments_read" ON public.assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assessments_insert" ON public.assessments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "assessments_update" ON public.assessments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- INVOICES
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  taxpayer_id uuid NOT NULL REFERENCES public.taxpayers(id) ON DELETE CASCADE,
  revenue_source text NOT NULL,
  amount numeric NOT NULL,
  issued_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'UNPAID',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_read" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- PAYMENTS
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL REFERENCES public.invoices(invoice_no) ON DELETE CASCADE,
  channel text NOT NULL,
  amount numeric NOT NULL,
  payer_ref text,
  cashier_name text,
  status text NOT NULL DEFAULT 'COMPLETED',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_read" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);

-- RECEIPTS
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  serial text NOT NULL UNIQUE,
  qr_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipts_read" ON public.receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "receipts_insert" ON public.receipts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "receipts_update" ON public.receipts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ARREARS
CREATE TABLE public.arrears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxpayer_id uuid NOT NULL REFERENCES public.taxpayers(id) ON DELETE CASCADE,
  invoice_no text NOT NULL,
  original_amount numeric NOT NULL,
  outstanding_amount numeric NOT NULL,
  due_date date NOT NULL,
  days_overdue integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'OUTSTANDING',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.arrears TO authenticated;
GRANT ALL ON public.arrears TO service_role;
ALTER TABLE public.arrears ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arrears_read" ON public.arrears FOR SELECT TO authenticated USING (true);
CREATE POLICY "arrears_insert" ON public.arrears FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "arrears_update" ON public.arrears FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- AUDIT LOG (append only)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- RECONCILIATION
CREATE TABLE public.recon_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id uuid NOT NULL REFERENCES public.councils(id),
  source text NOT NULL,
  file_name text NOT NULL,
  total_lines integer NOT NULL DEFAULT 0,
  matched_lines integer NOT NULL DEFAULT 0,
  unmatched_lines integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'COMPLETED',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.recon_batches TO authenticated;
GRANT ALL ON public.recon_batches TO service_role;
ALTER TABLE public.recon_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recon_b_read" ON public.recon_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "recon_b_insert" ON public.recon_batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "recon_b_update" ON public.recon_batches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.recon_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.recon_batches(id) ON DELETE CASCADE,
  statement_ref text NOT NULL,
  statement_amount numeric NOT NULL,
  statement_date date NOT NULL,
  matched_invoice_no text,
  status text NOT NULL DEFAULT 'UNMATCHED',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.recon_items TO authenticated;
GRANT ALL ON public.recon_items TO service_role;
ALTER TABLE public.recon_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recon_i_read" ON public.recon_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "recon_i_insert" ON public.recon_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "recon_i_update" ON public.recon_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ SEED ============
INSERT INTO public.councils (name, code, district) VALUES
  ('Mukono Municipal Council','MKO','Mukono'),
  ('Jinja City Council','JJA','Jinja'),
  ('Entebbe Municipal Council','EBB','Wakiso');

INSERT INTO public.fee_schedules (council_id, revenue_source, description, amount, period)
SELECT c.id, f.src, f.descr, f.amt, f.per
FROM public.councils c
CROSS JOIN (VALUES
  ('MARKET_DUE','Daily market stall due',5000,'MONTHLY'),
  ('MARKET_DUE','Lock-up shop rent',150000,'MONTHLY'),
  ('LICENCE_FEE','General trading licence',450000,'ANNUALLY'),
  ('LICENCE_FEE','Liquor and bar licence',780000,'ANNUALLY'),
  ('PARK_FEE','Taxi park loading fee',85000,'MONTHLY'),
  ('PARK_FEE','Boda-boda stage fee',30000,'QUARTERLY'),
  ('PROPERTY_RATE','Commercial property rate',1250000,'ANNUALLY'),
  ('PROPERTY_RATE','Residential property rate',380000,'ANNUALLY')
) AS f(src,descr,amt,per);

WITH mk AS (SELECT id FROM public.councils WHERE code='MKO'),
     jj AS (SELECT id FROM public.councils WHERE code='JJA'),
     eb AS (SELECT id FROM public.councils WHERE code='EBB')
INSERT INTO public.taxpayers (taxpayer_code, name, type, nin, tin, phone, email, address, location, council_id)
VALUES
 ('TXP-2214-0091','Nakivubo Traders Ltd','BUSINESS',NULL,'1002348871','+256 772 118 402','info@nakivubotraders.ug','Plot 14 Market Rd','Mukono Town',(SELECT id FROM mk)),
 ('TXP-1188-0204','Robert Okello','INDIVIDUAL','CM90210458XKJA','1004429013','+256 701 552 118','r.okello@gmail.com','Lubya Zone B','Lubya',(SELECT id FROM mk)),
 ('TXP-0921-0037','Buganda Motor Ltd','BUSINESS',NULL,'1001938442','+256 414 320 118','accounts@bugandamotor.ug','Entebbe Road','Entebbe Rd',(SELECT id FROM mk)),
 ('TXP-3301-0012','Mukono Central Market Assoc.','BUSINESS',NULL,'1009982211','+256 772 900 331','mcma@marketsug.org','Bazaar Lane','Bazaar',(SELECT id FROM mk)),
 ('TXP-4412-0088','Sarah Nanyondo','INDIVIDUAL','CF88031122LKQR','1003311228','+256 782 441 900','s.nanyondo@yahoo.com','Lubira Hill','Lubira',(SELECT id FROM mk)),
 ('TXP-2077-0156','Kampala Brew Distributors','BUSINESS',NULL,'1007712349','+256 393 220 114','ops@kbdistributors.ug','Jinja Road km 4','Jinja Rd',(SELECT id FROM mk)),
 ('TXP-1540-0073','Kabalega Transport Co.','BUSINESS',NULL,'1004410092','+256 752 118 004','fleet@kabalega.co.ug','Old Taxi Park','Bus Stop',(SELECT id FROM mk)),
 ('TXP-5520-0041','Agnes Nakato','INDIVIDUAL','CF91114420PWQZ','1002211887','+256 704 331 220','agnes.nakato@gmail.com','Lukaya Trading Ctr','Lukaya',(SELECT id FROM mk)),
 ('TXP-3388-0119','Mutundwe Rice Mills','BUSINESS',NULL,'1008812340','+256 772 004 118','mill@mutundwerice.ug','Industrial Area','Industrial',(SELECT id FROM mk)),
 ('TXP-9012-0028','Joseph Kato','INDIVIDUAL','CM87220119ABCD','1001120043','+256 758 220 447','j.kato@outlook.com','Nsambya Rd','Nsambya',(SELECT id FROM mk)),
 ('TXP-6611-0202','Ssebowa Hardware','BUSINESS',NULL,'1006612009','+256 772 660 010','sales@ssebowahw.ug','Plot 3 Kayunga Rd','Mukono Town',(SELECT id FROM mk)),
 ('TXP-7722-0310','Grace Auma','INDIVIDUAL','CF93112200XZQA','1005512338','+256 703 771 220','grace.auma@gmail.com','Seeta Zone A','Seeta',(SELECT id FROM mk)),
 ('TXP-8100-0044','Nile Breweries Depot','BUSINESS',NULL,'1000112234','+256 434 120 300','depot@nilebreweries.ug','Yusuf Lule Rd','Jinja Central',(SELECT id FROM jj)),
 ('TXP-8100-0045','Jinja Fish Traders','BUSINESS',NULL,'1000112235','+256 772 331 002','jft@fishug.org','Masese Landing','Masese',(SELECT id FROM jj)),
 ('TXP-8100-0046','Peter Wambi','INDIVIDUAL','CM89112003QWER','1000112236','+256 701 990 442','p.wambi@gmail.com','Walukuba East','Walukuba',(SELECT id FROM jj)),
 ('TXP-8100-0047','Source of the Nile Hotel','BUSINESS',NULL,'1000112237','+256 434 121 555','front@sonhotel.ug','Nile Crescent','Jinja Central',(SELECT id FROM jj)),
 ('TXP-8100-0048','Mary Babirye','INDIVIDUAL','CF92004411ZXCV','1000112238','+256 782 003 119','m.babirye@yahoo.com','Mpumudde','Mpumudde',(SELECT id FROM jj)),
 ('TXP-8100-0049','Kakira Sugar Outlet','BUSINESS',NULL,'1000112239','+256 434 122 700','outlet@kakirasugar.ug','Kakira Rd','Kakira',(SELECT id FROM jj)),
 ('TXP-9200-0051','Entebbe Airport Cargo Ltd','BUSINESS',NULL,'1009200051','+256 414 320 900','cargo@ebbcargo.ug','Airport Rd','Kitoro',(SELECT id FROM eb)),
 ('TXP-9200-0052','Lake View Curio Market','BUSINESS',NULL,'1009200052','+256 772 220 118','curio@lakeviewug.org','Beach Road','Beach Rd',(SELECT id FROM eb)),
 ('TXP-9200-0053','David Ssempala','INDIVIDUAL','CM90114422HJKL','1009200053','+256 701 220 883','d.ssempala@gmail.com','Katabi','Katabi',(SELECT id FROM eb)),
 ('TXP-9200-0054','Entebbe Fresh Produce','BUSINESS',NULL,'1009200054','+256 772 118 776','fresh@efp.ug','Kitooro Market','Kitooro',(SELECT id FROM eb)),
 ('TXP-9200-0055','Prossy Nabukenya','INDIVIDUAL','CF94002211MNBV','1009200055','+256 758 004 221','prossy.n@gmail.com','Nakiwogo','Nakiwogo',(SELECT id FROM eb)),
 ('TXP-9200-0056','Victoria Boat Services','BUSINESS',NULL,'1009200056','+256 772 553 001','book@victoriaboats.ug','Nakiwogo Landing','Nakiwogo',(SELECT id FROM eb));

-- premises: 1-2 per taxpayer
INSERT INTO public.premises (name, type, market, ward, taxpayer_id)
SELECT t.name || ' — Main premise',
       CASE (row_number() OVER (ORDER BY t.taxpayer_code)) % 4
         WHEN 0 THEN 'MARKET_STALL' WHEN 1 THEN 'SHOP' WHEN 2 THEN 'WAREHOUSE' ELSE 'PROPERTY' END,
       t.location, t.location, t.id
FROM public.taxpayers t;

INSERT INTO public.premises (name, type, market, ward, taxpayer_id)
SELECT t.name || ' — Annex stall','MARKET_STALL', t.location, t.location, t.id
FROM public.taxpayers t WHERE t.type = 'BUSINESS';

-- assessments + invoices over the last 6 months
WITH base AS (
  SELECT p.id AS premise_id, p.taxpayer_id, t.council_id,
         row_number() OVER (ORDER BY p.created_at, p.id) AS rn
  FROM public.premises p JOIN public.taxpayers t ON t.id = p.taxpayer_id
),
months AS (SELECT generate_series(0,5) AS m),
combos AS (
  SELECT b.*, m.m,
         (SELECT fs.id FROM public.fee_schedules fs WHERE fs.council_id = b.council_id
           ORDER BY md5(fs.id::text || b.rn::text || m.m::text) LIMIT 1) AS fee_id
  FROM base b CROSS JOIN months m
  WHERE (b.rn + m.m) % 2 = 0
),
ins_a AS (
  INSERT INTO public.assessments (premise_id, fee_schedule_id, amount, due_date, period, status, created_at)
  SELECT c.premise_id, c.fee_id, fs.amount,
         (date_trunc('month', now()) - (c.m || ' month')::interval + interval '20 day')::date,
         to_char(date_trunc('month', now()) - (c.m || ' month')::interval,'YYYY-MM'),
         'PENDING',
         date_trunc('month', now()) - (c.m || ' month')::interval + interval '2 day'
  FROM combos c JOIN public.fee_schedules fs ON fs.id = c.fee_id
  RETURNING id, premise_id, amount, due_date, created_at, fee_schedule_id
)
INSERT INTO public.invoices (invoice_no, assessment_id, taxpayer_id, revenue_source, amount, issued_date, due_date, status, created_at)
SELECT 'INV-' || to_char(a.created_at,'YYYYMM') || '-' || lpad((row_number() OVER (ORDER BY a.created_at, a.id))::text, 4, '0'),
       a.id, p.taxpayer_id, fs.revenue_source, a.amount, a.created_at::date, a.due_date, 'UNPAID', a.created_at
FROM ins_a a
JOIN public.premises p ON p.id = a.premise_id
JOIN public.fee_schedules fs ON fs.id = a.fee_schedule_id;

-- payments for ~70% of invoices
WITH picked AS (
  SELECT i.invoice_no, i.amount, i.created_at,
         row_number() OVER (ORDER BY i.created_at, i.invoice_no) AS rn
  FROM public.invoices i
  WHERE md5(i.invoice_no) < 'b'
),
ins_p AS (
  INSERT INTO public.payments (invoice_no, channel, amount, payer_ref, cashier_name, status, created_at)
  SELECT p.invoice_no,
         CASE p.rn % 5 WHEN 0 THEN 'CASHIER' WHEN 1 THEN 'USSD' WHEN 2 THEN 'USSD' ELSE 'MOMO' END,
         p.amount,
         'REF' || lpad((100000 + p.rn * 37)::text, 8, '0'),
         CASE p.rn % 5 WHEN 0 THEN 'D. Achen' ELSE NULL END,
         'COMPLETED',
         p.created_at + interval '6 day' + ((p.rn % 9) || ' hour')::interval
  FROM picked p
  RETURNING id, invoice_no, created_at
)
INSERT INTO public.receipts (payment_id, serial, qr_token, status)
SELECT x.id,
       'MK-041-' || lpad((88000 + row_number() OVER (ORDER BY x.created_at, x.id))::text, 5, '0'),
       encode(digest_placeholder.v, 'hex'),
       'ACTIVE'
FROM ins_p x
CROSS JOIN LATERAL (SELECT md5(x.id::text)::bytea AS v) AS digest_placeholder;

UPDATE public.invoices i SET status = 'PAID'
WHERE EXISTS (SELECT 1 FROM public.payments p WHERE p.invoice_no = i.invoice_no);

UPDATE public.assessments a SET status = 'PAID'
WHERE EXISTS (SELECT 1 FROM public.invoices i WHERE i.assessment_id = a.id AND i.status = 'PAID');

UPDATE public.assessments a SET status = 'OVERDUE'
WHERE a.status = 'PENDING' AND a.due_date < current_date;

-- arrears from unpaid overdue invoices
INSERT INTO public.arrears (taxpayer_id, invoice_no, original_amount, outstanding_amount, due_date, days_overdue, status)
SELECT i.taxpayer_id, i.invoice_no, i.amount, i.amount, i.due_date,
       GREATEST(0, (current_date - i.due_date)), 'OUTSTANDING'
FROM public.invoices i
WHERE i.status = 'UNPAID' AND i.due_date < current_date;

-- reconciliation
WITH b AS (
  INSERT INTO public.recon_batches (council_id, source, file_name, total_lines, matched_lines, unmatched_lines, status, created_at)
  SELECT c.id, s.src, s.fname, 0,0,0,'COMPLETED', now() - (s.days || ' day')::interval
  FROM public.councils c
  CROSS JOIN (VALUES ('BANK_STATEMENT','stanbic-mko-stmt-0725.csv',3),('TELECOM_REPORT','mtn-momo-settlement-0725.csv',1)) AS s(src,fname,days)
  WHERE c.code = 'MKO'
  RETURNING id, created_at
)
INSERT INTO public.recon_items (batch_id, statement_ref, statement_amount, statement_date, matched_invoice_no, status)
SELECT b.id,
       'STMT-' || lpad((4000 + g)::text,6,'0'),
       (50000 + (g * 37000) % 900000)::numeric,
       (b.created_at - (g || ' hour')::interval)::date,
       CASE WHEN g % 4 = 0 THEN NULL ELSE (SELECT invoice_no FROM public.invoices ORDER BY md5(invoice_no || g::text) LIMIT 1) END,
       CASE WHEN g % 4 = 0 THEN 'UNMATCHED' WHEN g % 7 = 0 THEN 'MANUAL_MATCH' ELSE 'MATCHED' END
FROM b CROSS JOIN generate_series(1,12) g;

UPDATE public.recon_batches rb SET
  total_lines = s.total, matched_lines = s.matched, unmatched_lines = s.total - s.matched
FROM (SELECT batch_id, count(*) AS total, count(*) FILTER (WHERE status <> 'UNMATCHED') AS matched
      FROM public.recon_items GROUP BY batch_id) s
WHERE s.batch_id = rb.id;

-- audit log
INSERT INTO public.audit_logs (actor, action, entity, entity_id, details, created_at)
SELECT
  (ARRAY['D. Achen','S. Mugisha','R. Nakiwala','system'])[1 + (g % 4)],
  (ARRAY['LOGIN','CREATE','UPDATE','PAYMENT_POSTED','RECEIPT_ISSUED','EXPORT'])[1 + (g % 6)],
  (ARRAY['SESSION','TAXPAYER','INVOICE','PAYMENT','RECEIPT','REPORT'])[1 + (g % 6)],
  'ENT-' || lpad(g::text,5,'0'),
  'Automated demo activity entry #' || g,
  now() - (g || ' hour')::interval
FROM generate_series(1,60) g;