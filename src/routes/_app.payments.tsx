import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCouncil } from "@/lib/council";
import { useAuth } from "@/lib/auth";
import { logAudit, useInvoices, usePayments } from "@/lib/data";
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
import { CHANNELS, channelTone, clockTime, compactUgx, randomRef, shortDate, ugx } from "@/lib/eosr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/payments")({
  head: () => ({
    meta: [
      { title: "Mobile Money Payments — e-OSR" },
      {
        name: "description",
        content:
          "Collect council revenue through MTN/Airtel mobile money, USSD and cashier desks, settling invoices and issuing QR receipts instantly.",
      },
      { property: "og:title", content: "Mobile Money Payments — e-OSR" },
      {
        property: "og:description",
        content: "MOMO, USSD and cashier collection with instant receipting.",
      },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { councilId, council } = useCouncil();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const invoices = useInvoices(councilId);
  const payments = usePayments(councilId);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [channel, setChannel] = useState<string>("MOMO");
  const [amount, setAmount] = useState("");
  const [payerRef, setPayerRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const openInvoices = useMemo(
    () => (invoices.data ?? []).filter((i) => i.status !== "PAID"),
    [invoices.data],
  );
  const selected = openInvoices.find((i) => i.invoice_no === invoiceNo);

  const rows = useMemo(() => {
    const list = payments.data ?? [];
    return filter === "ALL" ? list : list.filter((p) => p.channel === filter);
  }, [payments.data, filter]);

  const totals = useMemo(() => {
    const list = (payments.data ?? []).filter((p) => p.status === "COMPLETED");
    const value = list.reduce((s, p) => s + Number(p.amount), 0);
    const byChannel = Object.fromEntries(
      CHANNELS.map((c) => [
        c,
        list.filter((p) => p.channel === c).reduce((s, p) => s + Number(p.amount), 0),
      ]),
    ) as Record<string, number>;
    return { value, count: list.length, byChannel };
  }, [payments.data]);

  async function collect(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast.error("Select an open invoice");
      return;
    }
    const value = Number(amount || selected.amount);
    if (!value || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const ref =
        payerRef ||
        (channel === "CASHIER" ? `DESK${Math.floor(Math.random() * 9000 + 1000)}` : randomRef(channel));
      const { data: payment, error } = await supabase
        .from("payments")
        .insert({
          invoice_no: selected.invoice_no,
          channel,
          amount: value,
          payer_ref: ref,
          cashier_name: channel === "CASHIER" ? (profile?.full_name ?? "Cashier desk") : null,
          status: "COMPLETED",
        })
        .select()
        .single();
      if (error) throw error;

      const serial = `${council?.code ?? "OSR"}-${new Date().getFullYear()}-${Math.floor(
        Math.random() * 900000 + 100000,
      )}`;
      const { error: rErr } = await supabase.from("receipts").insert({
        payment_id: payment.id,
        serial,
        qr_token: `${serial}-${crypto.randomUUID().slice(0, 12)}`,
        status: "ACTIVE",
      });
      if (rErr) throw rErr;

      const fullySettled = value >= Number(selected.amount);
      if (fullySettled) {
        await supabase.from("invoices").update({ status: "PAID" }).eq("invoice_no", selected.invoice_no);
        await supabase
          .from("arrears")
          .update({ outstanding_amount: 0, status: "SETTLED" })
          .eq("invoice_no", selected.invoice_no);
      }

      await logAudit({
        actor: profile?.full_name ?? "staff",
        action: "PAYMENT_COLLECTED",
        entity: "payments",
        entity_id: selected.invoice_no,
        details: `${channel} · UGX ${ugx(value)} · receipt ${serial}`,
      });

      toast.success(`Payment captured · receipt ${serial}`);
      setInvoiceNo("");
      setAmount("");
      setPayerRef("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["payments"] }),
        qc.invalidateQueries({ queryKey: ["invoices"] }),
        qc.invalidateQueries({ queryKey: ["receipts"] }),
        qc.invalidateQueries({ queryKey: ["arrears"] }),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Settled value" value={compactUgx(totals.value)} note={`${totals.count} transactions`} />
        <Kpi label="Mobile money" value={compactUgx(totals.byChannel["MOMO"] ?? 0)} note="MTN / Airtel" />
        <Kpi label="USSD" value={compactUgx(totals.byChannel["USSD"] ?? 0)} note="*217# short code" />
        <Kpi label="Cashier desk" value={compactUgx(totals.byChannel["CASHIER"] ?? 0)} note="counter collections" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.7fr]">
        <Panel title="Collect payment" meta="SETTLE AN OPEN INVOICE">
          <form onSubmit={collect} className="space-y-3">
            <Field label="Open invoice">
              <select
                value={invoiceNo}
                onChange={(e) => {
                  setInvoiceNo(e.target.value);
                  const inv = openInvoices.find((i) => i.invoice_no === e.target.value);
                  setAmount(inv ? String(inv.amount) : "");
                }}
                className={inputClass}
              >
                <option value="">Select invoice…</option>
                {openInvoices.map((i) => (
                  <option key={i.id} value={i.invoice_no}>
                    {i.invoice_no} — {i.taxpayer?.name} ({ugx(i.amount)})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Channel">
              <div className="grid grid-cols-3 gap-1.5">
                {CHANNELS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChannel(c)}
                    className={cn(
                      "num rounded-sm border px-2 py-2 text-[10px] tracking-wider transition-colors",
                      channel === c
                        ? "border-civic/40 bg-civic/10 text-civic"
                        : "border-line bg-panel2 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label="Amount (UGX)"
              hint={selected ? `Invoice balance ${ugx(selected.amount)}` : undefined}
            >
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                className={inputClass}
                placeholder="0"
              />
            </Field>

            <Field label="Payer reference" hint="Leave blank to auto-generate a channel reference">
              <input
                value={payerRef}
                onChange={(e) => setPayerRef(e.target.value)}
                className={inputClass}
                placeholder="MOMO12345678"
              />
            </Field>

            {selected && (
              <div className="rounded-sm border border-line bg-panel2 p-3">
                <div className="label-mono">Settlement preview</div>
                <div className="num mt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TAXPAYER</span>
                    <span>{selected.taxpayer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SOURCE</span>
                    <span>{selected.revenue_source.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DUE</span>
                    <span>{shortDate(selected.due_date)}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-1">
                    <span className="text-muted-foreground">TOTAL</span>
                    <span className="font-medium text-civic">UGX {ugx(amount || selected.amount)}</span>
                  </div>
                </div>
              </div>
            )}

            <button type="submit" disabled={busy} className={cn(buttonClass, "w-full")}>
              {busy ? "PROCESSING…" : "CAPTURE PAYMENT & ISSUE RECEIPT"}
            </button>
          </form>
        </Panel>

        <Panel
          title="Transaction log"
          meta={`${rows.length} RECORDS`}
          bodyClassName="p-0"
          right={
            <div className="flex gap-1">
              {["ALL", ...CHANNELS].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  className={cn(
                    "num rounded-sm px-2 py-1 text-[10px] tracking-wider transition-colors",
                    filter === c
                      ? "bg-civic/10 text-civic ring-1 ring-civic/25"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          }
        >
          {payments.isLoading ? (
            <LoadingRow />
          ) : rows.length === 0 ? (
            <EmptyRow>No transactions recorded</EmptyRow>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-line">
                    {["Time", "Invoice", "Taxpayer", "Channel", "Reference", "Amount", "Status"].map((h) => (
                      <th key={h} className="label-mono px-4 py-2 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-panel2">
                      <td className="num px-4 py-2.5 text-[10px] text-muted-foreground">
                        {shortDate(p.created_at)} {clockTime(p.created_at)}
                      </td>
                      <td className="num px-4 py-2.5 text-[11px] text-civic">{p.invoice_no}</td>
                      <td className="px-4 py-2.5 text-[12px]">{p.invoice?.taxpayer?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "num rounded-sm px-1.5 py-0.5 text-[9px] ring-1",
                            channelTone[p.channel] ?? "bg-accent text-muted-foreground ring-border",
                          )}
                        >
                          {p.channel}
                        </span>
                      </td>
                      <td className="num px-4 py-2.5 text-[10px] text-muted-foreground">
                        {p.payer_ref ?? p.cashier_name ?? "—"}
                      </td>
                      <td className="num px-4 py-2.5 text-[12px] font-medium">{ugx(p.amount)}</td>
                      <td className="px-4 py-2.5">
                        <Pill value={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
