CREATE TABLE public.council_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id uuid NOT NULL REFERENCES public.councils(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'BUDGET',
  title text NOT NULL,
  fiscal_year text NOT NULL DEFAULT '2026/27',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.council_documents TO authenticated;
GRANT ALL ON public.council_documents TO service_role;

ALTER TABLE public.council_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY cd_read ON public.council_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY cd_insert ON public.council_documents FOR INSERT TO authenticated WITH CHECK (public.can_manage_council(council_id));
CREATE POLICY cd_update ON public.council_documents FOR UPDATE TO authenticated USING (public.can_manage_council(council_id)) WITH CHECK (public.can_manage_council(council_id));
CREATE POLICY cd_delete ON public.council_documents FOR DELETE TO authenticated USING (public.can_manage_council(council_id));

CREATE TRIGGER council_documents_updated_at BEFORE UPDATE ON public.council_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX council_documents_council_idx ON public.council_documents(council_id, created_at DESC);

-- System administrators may register new councils
CREATE POLICY councils_admin_insert ON public.councils FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- Storage policies for the private council-documents bucket.
-- Objects are stored as <council_id>/<filename>
CREATE POLICY "council docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'council-documents');

CREATE POLICY "council docs insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'council-documents'
    AND public.can_manage_council(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "council docs update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'council-documents'
    AND public.can_manage_council(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'council-documents'
    AND public.can_manage_council(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "council docs delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'council-documents'
    AND public.can_manage_council(((storage.foldername(name))[1])::uuid)
  );