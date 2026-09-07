CREATE TABLE public.momo_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_no text NOT NULL,
  msisdn text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  external_id text NOT NULL,
  reference_id text NOT NULL,
  provider text NOT NULL DEFAULT 'MTN_SANDBOX',
  mode text NOT NULL DEFAULT 'SANDBOX',
  status text NOT NULL DEFAULT 'PENDING',
  financial_transaction_id text,
  reason text,
  payment_id uuid REFERENCES public.payments(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.momo_transactions TO authenticated;
GRANT ALL ON public.momo_transactions TO service_role;
ALTER TABLE public.momo_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "momo_read" ON public.momo_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "momo_insert" ON public.momo_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "momo_update" ON public.momo_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.sms_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  msisdn text NOT NULL,
  body text NOT NULL,
  purpose text NOT NULL DEFAULT 'RECEIPT',
  invoice_no text,
  provider text NOT NULL DEFAULT 'AFRICASTALKING',
  mode text NOT NULL DEFAULT 'SANDBOX',
  status text NOT NULL DEFAULT 'QUEUED',
  provider_ref text,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sms_messages TO authenticated;
GRANT ALL ON public.sms_messages TO service_role;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_read" ON public.sms_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "sms_insert" ON public.sms_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sms_update" ON public.sms_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER momo_transactions_updated_at BEFORE UPDATE ON public.momo_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER sms_messages_updated_at BEFORE UPDATE ON public.sms_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();