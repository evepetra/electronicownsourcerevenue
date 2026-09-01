ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'MAYOR';

ALTER TABLE public.council_budgets
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.council_budgets
  ADD CONSTRAINT council_budgets_approval_status_check
  CHECK (approval_status IN ('DRAFT','SUBMITTED','APPROVED','RETURNED'));

UPDATE public.council_budgets SET approval_status = 'APPROVED', reviewed_at = now() WHERE approval_status = 'DRAFT';