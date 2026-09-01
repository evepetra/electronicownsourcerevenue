import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCouncil } from "@/lib/council";
import { useAuth } from "@/lib/auth";
import { logAudit, useInvoices, useReconBatches, useReconItems } from "@/lib/data";
import {
  buttonClass,
  EmptyRow,
  ghostButtonClass,
  inputClass,
  Kpi,
  LoadingRow,
  Panel,
  Pill,
} from "@/components/eosr/ui";
import { compactUgx, shortDate, ugx } from "@/lib/eosr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reconciliation")({
  head: () => ({
    meta: [
      { title: "Bank Reconciliation — e-OSR" },
      {
        name: "description",
        content:
          "Reconcile bank and mobile money settlement statements against council invoices, auto-match references and resolve unmatched lines.",
      },
      { property: "og:title", content: "Bank Reconciliation — e-OSR" },
      {
        property: "og:description",
        content: "Match settlement statement lines to invoices and clear exceptions.",
      },
    ],
  }),
  component: ReconciliationPage,
});

function ReconciliationPage() {
  const { councilId } = useCouncil();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const batches = useReconBatches(councilId);
  const [batchId, setBatchId] = useState<string | null>(null);
  const items = useReconItems(batchId);
  const invoices = useInvoices(councilId);
  const [manual, setManual] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!batchId && batches.data?.length) setBatchId(batches.data[0]?.id ?? null);
  }, [batches.data, batchId]);

  const summary = useMemo(() => {
    const list = batches.data ?? [];
    return {
      total: list.reduce((s, b) => s + b.total_lines, 0),
      matched: list.reduce((s, b) => s + b.matched_lines, 0),
      unmatched: list.reduce((s, b) => s + b.unmatched_lines, 0),
      value: (items.data ?? []).reduce((s, i) => s + Number(i.statement_amount), 0),
    };
  }, [batches.data, items.data]);

  async function refreshBatch(id: string) {
    const { data } = await supabase.from("recon_items").select("status").eq("batch_id", id);
    const rows = data ?? [];
    const matched = rows.filter((r) => r.status !== "UNMATCHED").length;
    await supabase
      .from("recon_batches")
      .update({
        total_lines: rows.length,
        matched_lines: matched,
        unmatched_lines: rows.length - matched,
        status: rows.length === matched ? "COMPLETED" : "PENDING",
      })
      .eq("id", id);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["recon_items"] }),
      qc.invalidateQueries({ queryKey: ["recon_batches"] }),
    ]);
  }

  async function autoMatch() {
    if (!batchId) return;
    const unmatched = (items.data ?? []).filter((i) => i.status === "UNMATCHED");
    const pool = invoices.data ?? [];
    let hits = 0;
    for (const item of unmatched) {
      const candidate = pool.find(
        (inv) =>
          Number(inv.amount) === Number(item.statement_amount) &&
          (item.statement_ref.includes(inv.invoice_no.slice(-6)) || inv.status === "PAID"),
      );
      if (!candidate) continue;
      const { error } = await supabase
        .from("recon_items")
        .update({ matched_invoice_no: candidate.invoice_no, status: "MATCHED" })
        .eq("id", item.id);
      if (!error) hits += 1;
    }
    await logAudit({
      actor: profile?.full_name ?? "staff",
      action: "RECON_AUTO_MATCH",
      entity: "recon_batches",
      entity_id: batchId,
      details: `${hits} lines auto-matched`,
    });
    await refreshBatch(batchId);
    toast[hits ? "success" : "info"](
      hits ? `${hits} statement lines matched` : "No further automatic matches found",
    );
  }

  async function matchManually(itemId: string) {
    const invoiceNo = manual[itemId];
    if (!invoiceNo) {
      toast.error("Enter an invoice number");
      return;
    }
    const { error } = await supabase
      .from("recon_items")
      .update({ matched_invoice_no: invoiceNo, status: "MANUAL_MATCH" })
      .eq("id", itemId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      actor: profile?.full_name ?? "staff",
      action: "RECON_MANUAL_MATCH",
      entity: "recon_items",
      entity_id: itemId,
      details: `Matched to ${invoiceNo}`,
    });
    if (batchId) await refreshBatch(batchId);
    toast.success("Statement line matched");
  }

  const activeBatch = (batches.data ?? []).find((b) => b.id === batchId);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Statement lines" value={String(summary.total)} unit="CT" note="all batches" />
        <Kpi label="Matched" value={String(summary.matched)} unit="CT" note="reconciled to invoices" />
        <Kpi
          label="Exceptions"
          value={String(summary.unmatched)}
          unit="CT"
          tone="destructive"
          note="require resolution"
        />
        <Kpi label="Batch value" value={compactUgx(summary.value)} note={activeBatch?.file_name ?? "—"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Panel title="Settlement batches" meta="UPLOADED STATEMENTS" bodyClassName="p-2">
          {batches.isLoading ? (
            <LoadingRow />
          ) : (
            <div className="space-y-1">
              {(batches.data ?? []).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBatchId(b.id)}
                  className={cn(
                    "block w-full rounded-sm border px-3 py-2.5 text-left transition-colors",
                    b.id === batchId
                      ? "border-civic/30 bg-civic/10"
                      : "border-transparent hover:bg-panel2",
                  )}
                >
                  <span className="num block text-[11px]">{b.file_name}</span>
                  <span className="num mt-1 flex items-center gap-2 text-[9px] text-muted-foreground">
                    {b.source} · {shortDate(b.created_at)} · {b.matched_lines}/{b.total_lines} MATCHED
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={activeBatch?.file_name ?? "Statement lines"}
          meta={activeBatch ? `${activeBatch.source} · ${activeBatch.status}` : "SELECT A BATCH"}
          bodyClassName="p-0"
          right={
            <button type="button" className={buttonClass} onClick={() => void autoMatch()}>
              AUTO-MATCH
            </button>
          }
        >
          {items.isLoading ? (
            <LoadingRow />
          ) : (items.data ?? []).length === 0 ? (
            <EmptyRow>No statement lines in this batch</EmptyRow>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-line">
                    {["Statement ref", "Date", "Amount", "Matched invoice", "Status", "Resolve"].map((h) => (
                      <th key={h} className="label-mono px-4 py-2 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(items.data ?? []).map((i) => (
                    <tr key={i.id} className="transition-colors hover:bg-panel2">
                      <td className="num px-4 py-2.5 text-[11px]">{i.statement_ref}</td>
                      <td className="num px-4 py-2.5 text-[11px] text-muted-foreground">
                        {shortDate(i.statement_date)}
                      </td>
                      <td className="num px-4 py-2.5 text-[12px] font-medium">
                        {ugx(i.statement_amount)}
                      </td>
                      <td className="num px-4 py-2.5 text-[11px] text-civic">
                        {i.matched_invoice_no ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Pill value={i.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        {i.status === "UNMATCHED" ? (
                          <div className="flex gap-1.5">
                            <input
                              value={manual[i.id] ?? ""}
                              onChange={(e) => setManual({ ...manual, [i.id]: e.target.value })}
                              placeholder="INV-…"
                              className={`${inputClass} h-8 w-32`}
                            />
                            <button
                              type="button"
                              className={ghostButtonClass}
                              onClick={() => void matchManually(i.id)}
                            >
                              MATCH
                            </button>
                          </div>
                        ) : (
                          <span className="num text-[10px] text-muted-foreground">CLEARED</span>
                        )}
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
