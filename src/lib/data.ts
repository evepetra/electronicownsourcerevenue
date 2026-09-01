import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Taxpayer = {
  id: string;
  taxpayer_code: string;
  name: string;
  type: string;
  nin: string | null;
  tin: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  location: string | null;
  council_id: string;
  is_active: boolean;
  created_at: string;
};

export type Premise = {
  id: string;
  name: string;
  type: string;
  market: string | null;
  ward: string | null;
  taxpayer_id: string;
  is_active: boolean;
};

export type FeeSchedule = {
  id: string;
  council_id: string;
  revenue_source: string;
  description: string;
  amount: number;
  period: string;
  is_active: boolean;
};

export type Invoice = {
  id: string;
  invoice_no: string;
  taxpayer_id: string;
  revenue_source: string;
  amount: number;
  issued_date: string;
  due_date: string;
  status: string;
  created_at: string;
  taxpayer?: { name: string; taxpayer_code: string; council_id: string; phone: string } | null;
};

export type Payment = {
  id: string;
  invoice_no: string;
  channel: string;
  amount: number;
  payer_ref: string | null;
  cashier_name: string | null;
  status: string;
  created_at: string;
  invoice?: Invoice | null;
};

export type Receipt = {
  id: string;
  payment_id: string;
  serial: string;
  qr_token: string;
  status: string;
  created_at: string;
  payment?: Payment | null;
};

export type Arrear = {
  id: string;
  taxpayer_id: string;
  invoice_no: string;
  original_amount: number;
  outstanding_amount: number;
  due_date: string;
  days_overdue: number;
  status: string;
  taxpayer?: { name: string; taxpayer_code: string; council_id: string; phone: string } | null;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
};

export type ReconBatch = {
  id: string;
  council_id: string;
  source: string;
  file_name: string;
  total_lines: number;
  matched_lines: number;
  unmatched_lines: number;
  status: string;
  created_at: string;
};

export type ReconItem = {
  id: string;
  batch_id: string;
  statement_ref: string;
  statement_amount: number;
  statement_date: string;
  matched_invoice_no: string | null;
  status: string;
};

async function run<T>(promise: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export function useTaxpayers(councilId: string | null) {
  return useQuery({
    queryKey: ["taxpayers", councilId],
    enabled: !!councilId,
    queryFn: () =>
      run<Taxpayer[]>(
        supabase
          .from("taxpayers")
          .select("*")
          .eq("council_id", councilId!)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function usePremises() {
  return useQuery({
    queryKey: ["premises"],
    queryFn: () => run<Premise[]>(supabase.from("premises").select("*").order("name")),
  });
}

export function useFeeSchedules(councilId: string | null) {
  return useQuery({
    queryKey: ["fee_schedules", councilId],
    enabled: !!councilId,
    queryFn: () =>
      run<FeeSchedule[]>(
        supabase
          .from("fee_schedules")
          .select("*")
          .eq("council_id", councilId!)
          .order("revenue_source"),
      ),
  });
}

const INVOICE_SELECT =
  "*, taxpayer:taxpayers!inner(name, taxpayer_code, council_id, phone)" as const;

export function useInvoices(councilId: string | null) {
  return useQuery({
    queryKey: ["invoices", councilId],
    enabled: !!councilId,
    queryFn: () =>
      run<Invoice[]>(
        supabase
          .from("invoices")
          .select(INVOICE_SELECT)
          .eq("taxpayer.council_id", councilId!)
          .order("issued_date", { ascending: false }),
      ),
  });
}

export function usePayments(councilId: string | null) {
  return useQuery({
    queryKey: ["payments", councilId],
    enabled: !!councilId,
    queryFn: async () => {
      const rows = await run<Payment[]>(
        supabase
          .from("payments")
          .select(`*, invoice:invoices(${INVOICE_SELECT})`)
          .order("created_at", { ascending: false }),
      );
      return rows.filter((p) => p.invoice?.taxpayer?.council_id === councilId);
    },
  });
}

export function useReceipts(councilId: string | null) {
  return useQuery({
    queryKey: ["receipts", councilId],
    enabled: !!councilId,
    queryFn: async () => {
      const rows = await run<Receipt[]>(
        supabase
          .from("receipts")
          .select(`*, payment:payments(*, invoice:invoices(${INVOICE_SELECT}))`)
          .order("created_at", { ascending: false }),
      );
      return rows.filter((r) => r.payment?.invoice?.taxpayer?.council_id === councilId);
    },
  });
}

export function useArrears(councilId: string | null) {
  return useQuery({
    queryKey: ["arrears", councilId],
    enabled: !!councilId,
    queryFn: () =>
      run<Arrear[]>(
        supabase
          .from("arrears")
          .select("*, taxpayer:taxpayers!inner(name, taxpayer_code, council_id, phone)")
          .eq("taxpayer.council_id", councilId!)
          .order("days_overdue", { ascending: false }),
      ),
  });
}

export function useAuditLogs(limit = 200) {
  return useQuery({
    queryKey: ["audit_logs", limit],
    queryFn: () =>
      run<AuditLog[]>(
        supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit),
      ),
  });
}

export function useReconBatches(councilId: string | null) {
  return useQuery({
    queryKey: ["recon_batches", councilId],
    enabled: !!councilId,
    queryFn: () =>
      run<ReconBatch[]>(
        supabase
          .from("recon_batches")
          .select("*")
          .eq("council_id", councilId!)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useReconItems(batchId: string | null) {
  return useQuery({
    queryKey: ["recon_items", batchId],
    enabled: !!batchId,
    queryFn: () =>
      run<ReconItem[]>(
        supabase
          .from("recon_items")
          .select("*")
          .eq("batch_id", batchId!)
          .order("statement_date", { ascending: false }),
      ),
  });
}

export async function logAudit(entry: {
  actor: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  details?: string | null;
}) {
  await supabase.from("audit_logs").insert(entry);
}
