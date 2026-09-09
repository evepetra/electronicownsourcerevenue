
-- 1. Move SECURITY DEFINER helpers into a private schema, keep public wrappers as INVOKER
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
      AND (
        _user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'ADMIN')
      )
  );
$$;

CREATE OR REPLACE FUNCTION app_private.current_council_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT council_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION app_private.is_oversight()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT app_private.has_role(auth.uid(), 'ADMIN') OR app_private.has_role(auth.uid(), 'AUDITOR');
$$;

CREATE OR REPLACE FUNCTION app_private.in_council(_council_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT app_private.is_oversight()
      OR (_council_id IS NOT NULL AND _council_id = app_private.current_council_id());
$$;

CREATE OR REPLACE FUNCTION app_private.can_manage_council(_council_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT app_private.has_role(auth.uid(), 'ADMIN')
      OR (
        app_private.has_role(auth.uid(), 'COUNCIL_ADMIN')
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.council_id = _council_id)
      );
$$;

CREATE OR REPLACE FUNCTION app_private.can_approve_council(_council_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT app_private.has_role(auth.uid(), 'ADMIN')
      OR (
        app_private.has_role(auth.uid(), 'MAYOR')
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.council_id = _council_id)
      );
$$;

-- public wrappers become SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.current_council_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.current_council_id() $$;

CREATE OR REPLACE FUNCTION public.is_oversight()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.is_oversight() $$;

CREATE OR REPLACE FUNCTION public.in_council(_council_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.in_council(_council_id) $$;

CREATE OR REPLACE FUNCTION public.can_manage_council(_council_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.can_manage_council(_council_id) $$;

CREATE OR REPLACE FUNCTION public.can_approve_council(_council_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.can_approve_council(_council_id) $$;

-- 2. Audit logs: actor must be the signed-in user
DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND actor = COALESCE((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), auth.uid()::text)
);

-- 3. Councils: no anonymous access to contact details
DROP POLICY IF EXISTS councils_public_read ON public.councils;
REVOKE SELECT ON public.councils FROM anon;

CREATE OR REPLACE VIEW public.councils_public
WITH (security_invoker = off) AS
  SELECT id, name, code, district FROM public.councils;
GRANT SELECT ON public.councils_public TO anon, authenticated;

-- 4. Mobile money: writes scoped to the invoice's council
DROP POLICY IF EXISTS momo_insert ON public.momo_transactions;
DROP POLICY IF EXISTS momo_update ON public.momo_transactions;
CREATE POLICY momo_insert ON public.momo_transactions FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.invoices i JOIN public.taxpayers t ON t.id = i.taxpayer_id
  WHERE i.invoice_no = momo_transactions.invoice_no AND public.in_council(t.council_id)
));
CREATE POLICY momo_update ON public.momo_transactions FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.invoices i JOIN public.taxpayers t ON t.id = i.taxpayer_id
  WHERE i.invoice_no = momo_transactions.invoice_no AND public.in_council(t.council_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.invoices i JOIN public.taxpayers t ON t.id = i.taxpayer_id
  WHERE i.invoice_no = momo_transactions.invoice_no AND public.in_council(t.council_id)
));

-- 5. SMS: writes scoped to the invoice's council (or oversight)
DROP POLICY IF EXISTS sms_insert ON public.sms_messages;
DROP POLICY IF EXISTS sms_update ON public.sms_messages;
CREATE POLICY sms_insert ON public.sms_messages FOR INSERT TO authenticated
WITH CHECK (
  public.is_oversight()
  OR EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.taxpayers t ON t.id = i.taxpayer_id
    WHERE i.invoice_no = sms_messages.invoice_no AND public.in_council(t.council_id)
  )
  OR (sms_messages.invoice_no IS NULL AND EXISTS (
    SELECT 1 FROM public.taxpayers t
    WHERE t.phone IS NOT NULL AND public.in_council(t.council_id)
      AND regexp_replace(t.phone, '\D', '', 'g') LIKE '%' || right(regexp_replace(sms_messages.msisdn, '\D', '', 'g'), 9)
  ))
);
CREATE POLICY sms_update ON public.sms_messages FOR UPDATE TO authenticated
USING (
  public.is_oversight()
  OR EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.taxpayers t ON t.id = i.taxpayer_id
    WHERE i.invoice_no = sms_messages.invoice_no AND public.in_council(t.council_id)
  )
)
WITH CHECK (
  public.is_oversight()
  OR EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.taxpayers t ON t.id = i.taxpayer_id
    WHERE i.invoice_no = sms_messages.invoice_no AND public.in_council(t.council_id)
  )
);

-- 6. Remove duplicate permissive reconciliation policies
DROP POLICY IF EXISTS recon_b_read ON public.recon_batches;
DROP POLICY IF EXISTS recon_b_insert ON public.recon_batches;
DROP POLICY IF EXISTS recon_b_update ON public.recon_batches;
DROP POLICY IF EXISTS recon_i_read ON public.recon_items;
DROP POLICY IF EXISTS recon_i_insert ON public.recon_items;
DROP POLICY IF EXISTS recon_i_update ON public.recon_items;
