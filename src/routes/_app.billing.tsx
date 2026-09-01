import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCouncil } from "@/lib/council";
import { useAuth } from "@/lib/auth";
import { logAudit, useFeeSchedules, useInvoices, useTaxpayers } from "@/lib/data";
import {
  buttonClass,
  EmptyRow,
  Field,
  inputClass,
  Kpi,
  LoadingRow,
  Panel,
  Pill,
} from "@/components/eosr/ui";
import { compactUgx, shortDate, ugx } from "@/lib/eosr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Invoices — e-OSR" },
      {
        name: "description",
        content:
          "Raise assessments from the council fee schedule, issue invoices to taxpayers and track paid, unpaid and overdue billing positions.",
      },
      { property: "og:title", content: "Billing & Invoices — e-OSR" },
      {
        property: "og:description",
        content: "Assess, invoice and track council revenue billing.",
      },
    ],
  }),
  component: BillingPage,
});

const STATUSES = ["ALL", "UNPAID", "PAID", "OVERDUE"];

function BillingPage() {
  const { councilId, council } = useCouncil();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const invoices = useInvoices(councilId);
  const taxpayers = useTaxpayers(councilId);
  const fees = useFeeSchedules(councilId);
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taxpayerId, setTaxpayerId] = useState("");
  const [feeId, setFeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));

  const rows = useMemo(() => {
    const list = invoices.data ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((i) => {
      if (status !== "ALL" && i.status !== status) return false;
      if (!needle) return true;
      return [i.invoice_no, i.taxpayer?.name ?? "", i.revenue_source]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [invoices.data, status, q]);

  const totals = useMemo(() => {
    const list = invoices.data ?? [];
    const billed = list.reduce((s, i) => s + Number(i.amount), 0);
    const unpaid = list
      .filter((i) => i.status !== "PAID")
      .reduce((s, i) => s + Number(i.amount), 0);
    const overdue = list.filter((i) => i.status === "OVERDUE").length;
    return { billed, unpaid, overdue, count: list.length };
  }, [invoices.data]);

  const selectedFee = (fees.data ?? []).find((f) => f.id === feeId);

  async function issueInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!taxpayerId || !selectedFee) {
      toast.error("Select a taxpayer and a fee item");
      return;
    }
    setBusy(true);
    try {
      const value = Number(amount || selectedFee.amount);
      const invoiceNo = `INV-${council?.code ?? "OSR"}-${Date.now().toString().slice(-8)}`;
      const { error } = await supabase.from("invoices").insert({
        invoice_no: invoiceNo,
        taxpayer_id: taxpayerId,
        revenue_source: selectedFee.revenue_source,
        amount: value,
        issued_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate,
        status: "UNPAID",
      });
      if (error) throw error;
      await logAudit({
        actor: profile?.full_name ?? "staff",
        action: "INVOICE_ISSUED",
        entity: "invoices",
        entity_id: invoiceNo,
        details: `${selectedFee.revenue_source} · UGX ${ugx(value)}`,
      });
      toast.success(`Invoice ${invoiceNo} issued`);
      setOpen(false);
      setAmount("");
      await qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not issue invoice");
    } finally {
      setBusy(false);
    }
  }

  async function markOverdue() {
    const today = new Date().toISOString().slice(0, 10);
    const stale = (invoices.data ?? []).filter(
      (i) => i.status === "UNPAID" && i.due_date < today,
    );
    if (!stale.length) {
      toast.info("No invoices past due");
      return;
    }
    const { error } = await supabase
      .from("invoices")
      .update({ status: "OVERDUE" })
      .in(
        "invoice_no",
        stale.map((i) => i.invoice_no),
      );
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      actor: profile?.full_name ?? "staff",
      action: "BILLING_RUN_OVERDUE",
      entity: "invoices",
      details: `${stale.length} invoices flagged overdue`,
    });
    toast.success(`${stale.length} invoices flagged overdue`);
    await qc.invalidateQueries({ queryKey: ["invoices"] });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Total billed" value={compactUgx(totals.billed)} note={`${totals.count} invoices`} />
        <Kpi label="Open balance" value={compactUgx(totals.unpaid)} tone="warn" note="awaiting settlement" />
        <Kpi label="Overdue invoices" value={String(totals.overdue)} unit="CT" tone="destructive" note="past due date" />
        <Kpi
          label="Fee items active"
          value={String((fees.data ?? []).filter((f) => f.is_active).length)}
          unit="CT"
          note="council schedule"
        />
      </div>

      <Panel
        title="Invoice ledger"
        meta={`${rows.length} SHOWN · ${council?.name ?? ""}`}
        bodyClassName="p-0"
        right={
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search invoice or taxpayer…"
              className={`${inputClass} w-52`}
            />
            <button type="button" className={buttonClass} onClick={() => setOpen((v) => !v)}>
              {open ? "CLOSE" : "+ ISSUE INVOICE"}
            </button>
          </>
        }
      >
        {open && (
          <form onSubmit={issueInvoice} className="grid gap-3 border-b border-line p-4 md:grid-cols-4">
            <Field label="Taxpayer">
              <select
                value={taxpayerId}
                onChange={(e) => setTaxpayerId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select taxpayer…</option>
                {(taxpayers.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.taxpayer_code} — {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fee item">
              <select value={feeId} onChange={(e) => setFeeId(e.target.value)} className={inputClass}>
                <option value="">Select fee…</option>
                {(fees.data ?? [])
                  .filter((f) => f.is_active)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.revenue_source.replace(/_/g, " ")} — {f.description}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Amount (UGX)" hint={selectedFee ? `Schedule: ${ugx(selectedFee.amount)}` : undefined}>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
                placeholder={selectedFee ? String(selectedFee.amount) : "0"}
                inputMode="numeric"
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="flex items-end gap-2 md:col-span-4">
              <button type="submit" disabled={busy} className={buttonClass}>
                {busy ? "ISSUING…" : "ISSUE INVOICE"}
              </button>
              <button type="button" className={buttonClass} onClick={() => void markOverdue()}>
                RUN OVERDUE SWEEP
              </button>
            </div>
          </form>
        )}

        <div className="flex gap-1 border-b border-line px-4 py-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "num rounded-sm px-2 py-1 text-[10px] tracking-wider transition-colors",
                status === s
                  ? "bg-civic/10 text-civic ring-1 ring-civic/25"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {invoices.isLoading ? (
          <LoadingRow />
        ) : rows.length === 0 ? (
          <EmptyRow>No invoices in this view</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Invoice", "Taxpayer", "Revenue source", "Issued", "Due", "Amount", "Status"].map((h) => (
                    <th key={h} className="label-mono px-4 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((i) => (
                  <tr key={i.id} className="transition-colors hover:bg-panel2">
                    <td className="num px-4 py-2.5 text-[11px] text-civic">{i.invoice_no}</td>
                    <td className="px-4 py-2.5">
                      <span className="block text-[12px]">{i.taxpayer?.name}</span>
                      <span className="num block text-[10px] text-muted-foreground">
                        {i.taxpayer?.taxpayer_code}
                      </span>
                    </td>
                    <td className="num px-4 py-2.5 text-[11px] text-muted-foreground">
                      {i.revenue_source.replace(/_/g, " ")}
                    </td>
                    <td className="num px-4 py-2.5 text-[11px]">{shortDate(i.issued_date)}</td>
                    <td className="num px-4 py-2.5 text-[11px]">{shortDate(i.due_date)}</td>
                    <td className="num px-4 py-2.5 text-[12px] font-medium">{ugx(i.amount)}</td>
                    <td className="px-4 py-2.5">
                      <Pill value={i.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
