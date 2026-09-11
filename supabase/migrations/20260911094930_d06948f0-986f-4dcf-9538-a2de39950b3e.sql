
-- 1. Storage: restrict reads to the owning council
DROP POLICY IF EXISTS "council docs read" ON storage.objects;
CREATE POLICY "council docs read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'council-documents'
    AND (
      public.is_oversight()
      OR public.in_council(((storage.foldername(name))[1])::uuid)
      OR public.can_manage_council(((storage.foldername(name))[1])::uuid)
    )
  );

-- 2. Councils: remove blanket anon read, expose only non-sensitive columns
DROP POLICY IF EXISTS "councils_public_read" ON public.councils;
REVOKE SELECT ON public.councils FROM anon;

CREATE OR REPLACE VIEW public.councils_public
WITH (security_invoker = off) AS
  SELECT id, name, code, district FROM public.councils;

GRANT SELECT ON public.councils_public TO anon, authenticated;

-- 3. SMS insert: exact normalized phone match instead of suffix wildcard
DROP POLICY IF EXISTS "sms_insert" ON public.sms_messages;
CREATE POLICY "sms_insert" ON public.sms_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_oversight()
    OR EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.taxpayers t ON t.id = i.taxpayer_id
      WHERE i.invoice_no = sms_messages.invoice_no AND public.in_council(t.council_id)
    )
    OR (
      invoice_no IS NULL AND EXISTS (
        SELECT 1 FROM public.taxpayers t
        WHERE t.phone IS NOT NULL
          AND public.in_council(t.council_id)
          AND "right"(regexp_replace(t.phone, '\D', '', 'g'), 9)
              = "right"(regexp_replace(sms_messages.msisdn, '\D', '', 'g'), 9)
          AND length(regexp_replace(t.phone, '\D', '', 'g')) >= 9
      )
    )
  );
