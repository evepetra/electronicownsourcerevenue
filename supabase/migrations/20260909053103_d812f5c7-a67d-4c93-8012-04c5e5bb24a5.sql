
-- helper functions
CREATE OR REPLACE FUNCTION public.current_council_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT council_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_oversight()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'AUDITOR');
$$;

CREATE OR REPLACE FUNCTION public.in_council(_council_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_oversight() OR (_council_id IS NOT NULL AND _council_id = public.current_council_id());
$$;

REVOKE ALL ON FUNCTION public.current_council_id() FROM anon;
REVOKE ALL ON FUNCTION public.is_oversight() FROM anon;
REVOKE ALL ON FUNCTION public.in_council(uuid) FROM anon;

-- prevent self-service role escalation
REVOKE EXECUTE ON FUNCTION public.claim_role(public.app_role) FROM anon, authenticated, PUBLIC;

-- profiles
DROP POLICY IF EXISTS profiles_read ON public.profiles;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_oversight());

-- user_roles
DROP POLICY IF EXISTS roles_read ON public.user_roles;
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_oversight());

-- audit logs
DROP POLICY IF EXISTS audit_read ON public.audit_logs;
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_oversight());

CREATE OR REPLACE FUNCTION public.set_audit_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.actor := COALESCE((SELECT email FROM public.profiles WHERE id = auth.uid()), auth.uid()::text);
  ELSE
    NEW.actor := 'system';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_logs_set_actor ON public.audit_logs;
CREATE TRIGGER audit_logs_set_actor BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_actor();

-- taxpayers
DROP POLICY IF EXISTS taxpayers_read ON public.taxpayers;
CREATE POLICY taxpayers_read ON public.taxpayers FOR SELECT TO authenticated
  USING (public.in_council(council_id));
DROP POLICY IF EXISTS taxpayers_insert ON public.taxpayers;
CREATE POLICY taxpayers_insert ON public.taxpayers FOR INSERT TO authenticated
  WITH CHECK (public.in_council(council_id));
DROP POLICY IF EXISTS taxpayers_update ON public.taxpayers;
CREATE POLICY taxpayers_update ON public.taxpayers FOR UPDATE TO authenticated
  USING (public.in_council(council_id)) WITH CHECK (public.in_council(council_id));

-- premises (via taxpayer)
DROP POLICY IF EXISTS premises_read ON public.premises;
CREATE POLICY premises_read ON public.premises FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = premises.taxpayer_id AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS premises_insert ON public.premises;
CREATE POLICY premises_insert ON public.premises FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = premises.taxpayer_id AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS premises_update ON public.premises;
CREATE POLICY premises_update ON public.premises FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = premises.taxpayer_id AND public.in_council(t.council_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = premises.taxpayer_id AND public.in_council(t.council_id)));

-- fee schedules
DROP POLICY IF EXISTS fees_read ON public.fee_schedules;
CREATE POLICY fees_read ON public.fee_schedules FOR SELECT TO authenticated
  USING (public.in_council(council_id));
DROP POLICY IF EXISTS fees_insert ON public.fee_schedules;
CREATE POLICY fees_insert ON public.fee_schedules FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_council(council_id) OR public.has_role(auth.uid(), 'ADMIN'));

-- assessments (via premise -> taxpayer)
DROP POLICY IF EXISTS assessments_read ON public.assessments;
CREATE POLICY assessments_read ON public.assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.premises p JOIN public.taxpayers t ON t.id = p.taxpayer_id
                 WHERE p.id = assessments.premise_id AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS assessments_insert ON public.assessments;
CREATE POLICY assessments_insert ON public.assessments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.premises p JOIN public.taxpayers t ON t.id = p.taxpayer_id
                 WHERE p.id = assessments.premise_id AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS assessments_update ON public.assessments;
CREATE POLICY assessments_update ON public.assessments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.premises p JOIN public.taxpayers t ON t.id = p.taxpayer_id
                 WHERE p.id = assessments.premise_id AND public.in_council(t.council_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.premises p JOIN public.taxpayers t ON t.id = p.taxpayer_id
                 WHERE p.id = assessments.premise_id AND public.in_council(t.council_id)));

-- invoices
DROP POLICY IF EXISTS invoices_read ON public.invoices;
CREATE POLICY invoices_read ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = invoices.taxpayer_id AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
CREATE POLICY invoices_insert ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = invoices.taxpayer_id AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS invoices_update ON public.invoices;
CREATE POLICY invoices_update ON public.invoices FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = invoices.taxpayer_id AND public.in_council(t.council_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = invoices.taxpayer_id AND public.in_council(t.council_id)));

-- arrears
DROP POLICY IF EXISTS arrears_read ON public.arrears;
CREATE POLICY arrears_read ON public.arrears FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = arrears.taxpayer_id AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS arrears_insert ON public.arrears;
CREATE POLICY arrears_insert ON public.arrears FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = arrears.taxpayer_id AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS arrears_update ON public.arrears;
CREATE POLICY arrears_update ON public.arrears FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = arrears.taxpayer_id AND public.in_council(t.council_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.taxpayers t WHERE t.id = arrears.taxpayer_id AND public.in_council(t.council_id)));

-- payments (via invoice_no)
DROP POLICY IF EXISTS payments_read ON public.payments;
CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i JOIN public.taxpayers t ON t.id = i.taxpayer_id
                 WHERE i.invoice_no = payments.invoice_no AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS payments_insert ON public.payments;
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i JOIN public.taxpayers t ON t.id = i.taxpayer_id
                 WHERE i.invoice_no = payments.invoice_no AND public.in_council(t.council_id)));

-- receipts (via payment)
DROP POLICY IF EXISTS receipts_read ON public.receipts;
CREATE POLICY receipts_read ON public.receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p JOIN public.invoices i ON i.invoice_no = p.invoice_no
                 JOIN public.taxpayers t ON t.id = i.taxpayer_id
                 WHERE p.id = receipts.payment_id AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS receipts_insert ON public.receipts;
CREATE POLICY receipts_insert ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.payments p JOIN public.invoices i ON i.invoice_no = p.invoice_no
                 JOIN public.taxpayers t ON t.id = i.taxpayer_id
                 WHERE p.id = receipts.payment_id AND public.in_council(t.council_id)));
DROP POLICY IF EXISTS receipts_update ON public.receipts;
CREATE POLICY receipts_update ON public.receipts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p JOIN public.invoices i ON i.invoice_no = p.invoice_no
                 JOIN public.taxpayers t ON t.id = i.taxpayer_id
                 WHERE p.id = receipts.payment_id AND public.in_council(t.council_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.payments p JOIN public.invoices i ON i.invoice_no = p.invoice_no
                 JOIN public.taxpayers t ON t.id = i.taxpayer_id
                 WHERE p.id = receipts.payment_id AND public.in_council(t.council_id)));

-- momo transactions
DROP POLICY IF EXISTS momo_read ON public.momo_transactions;
CREATE POLICY momo_read ON public.momo_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i JOIN public.taxpayers t ON t.id = i.taxpayer_id
                 WHERE i.invoice_no = momo_transactions.invoice_no AND public.in_council(t.council_id)));

-- sms messages
DROP POLICY IF EXISTS sms_read ON public.sms_messages;
CREATE POLICY sms_read ON public.sms_messages FOR SELECT TO authenticated
  USING (public.is_oversight() OR EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.taxpayers t ON t.id = i.taxpayer_id
    WHERE i.invoice_no = sms_messages.invoice_no AND public.in_council(t.council_id)));

-- reconciliation
DROP POLICY IF EXISTS recon_batches_read ON public.recon_batches;
CREATE POLICY recon_batches_read ON public.recon_batches FOR SELECT TO authenticated
  USING (public.in_council(council_id));
DROP POLICY IF EXISTS recon_batches_insert ON public.recon_batches;
CREATE POLICY recon_batches_insert ON public.recon_batches FOR INSERT TO authenticated
  WITH CHECK (public.in_council(council_id));
DROP POLICY IF EXISTS recon_batches_update ON public.recon_batches;
CREATE POLICY recon_batches_update ON public.recon_batches FOR UPDATE TO authenticated
  USING (public.in_council(council_id)) WITH CHECK (public.in_council(council_id));

DROP POLICY IF EXISTS recon_items_read ON public.recon_items;
CREATE POLICY recon_items_read ON public.recon_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recon_batches b WHERE b.id = recon_items.batch_id AND public.in_council(b.council_id)));
DROP POLICY IF EXISTS recon_items_insert ON public.recon_items;
CREATE POLICY recon_items_insert ON public.recon_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.recon_batches b WHERE b.id = recon_items.batch_id AND public.in_council(b.council_id)));
DROP POLICY IF EXISTS recon_items_update ON public.recon_items;
CREATE POLICY recon_items_update ON public.recon_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recon_batches b WHERE b.id = recon_items.batch_id AND public.in_council(b.council_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recon_batches b WHERE b.id = recon_items.batch_id AND public.in_council(b.council_id)));

-- council governance reads
DROP POLICY IF EXISTS cb_read ON public.council_budgets;
CREATE POLICY cb_read ON public.council_budgets FOR SELECT TO authenticated
  USING (public.in_council(council_id) OR public.has_role(auth.uid(), 'MAYOR'));
DROP POLICY IF EXISTS cs_read ON public.council_spending;
CREATE POLICY cs_read ON public.council_spending FOR SELECT TO authenticated
  USING (public.in_council(council_id) OR public.has_role(auth.uid(), 'MAYOR'));
DROP POLICY IF EXISTS cm_read ON public.council_meetings;
CREATE POLICY cm_read ON public.council_meetings FOR SELECT TO authenticated
  USING (public.in_council(council_id) OR public.has_role(auth.uid(), 'MAYOR'));
DROP POLICY IF EXISTS cd_read ON public.council_documents;
CREATE POLICY cd_read ON public.council_documents FOR SELECT TO authenticated
  USING (public.in_council(council_id) OR public.has_role(auth.uid(), 'MAYOR'));
