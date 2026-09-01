import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCouncil } from "@/lib/council";
import { useAuth } from "@/lib/auth";
import { logAudit, useReceipts, type Receipt } from "@/lib/data";
import {
  buttonClass,
  EmptyRow,
  ghostButtonClass,
  inputClass,
  LoadingRow,
  Panel,
  Pill,
} from "@/components/eosr/ui";
import { channelTone, clockTime, shortDate, ugx } from "@/lib/eosr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/receipts")({
  head: () => ({
    meta: [
      { title: "Receipt Verification — e-OSR" },
      {
        name: "description",
        content:
          "Verify council revenue receipts by serial or QR token, confirm settlement details and void fraudulent or duplicated receipts.",
      },
      { property: "og:title", content: "Receipt Verification — e-OSR" },
      {
        property: "og:description",
        content: "Verify and void QR-backed council revenue receipts.",
      },
    ],
  }),
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const { councilId } = useCouncil();
  const { role, profile } = useAuth();
  const qc = useQueryClient();
  const receipts = useReceipts(councilId);
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Receipt | null | undefined>(undefined);

  const rows = useMemo(() => {
    const list = receipts.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list.slice(0, 60);
    return list.filter((r) =>
      [r.serial, r.qr_token, r.payment?.invoice_no ?? "", r.payment?.invoice?.taxpayer?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [receipts.data, q]);

  function verify() {
    const needle = q.trim().toLowerCase();
    if (!needle) return;
    const found = (receipts.data ?? []).find(
      (r) => r.serial.toLowerCase() === needle || r.qr_token.toLowerCase() === needle,
    );
    setChecked(found ?? null);
    if (!found) toast.error("No receipt matches that serial or token");
  }

  async function voidReceipt(r: Receipt) {
    const { error } = await supabase.from("receipts").update({ status: "VOIDED" }).eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      actor: profile?.full_name ?? "staff",
      action: "RECEIPT_VOIDED",
      entity: "receipts",
      entity_id: r.serial,
      details: `Receipt voided for invoice ${r.payment?.invoice_no ?? "—"}`,
    });
    toast.success(`Receipt ${r.serial} voided`);
    setChecked(null);
    await qc.invalidateQueries({ queryKey: ["receipts"] });
  }

  return (
    <>
      <Panel
        title="Receipt verification"
        meta="SCAN OR ENTER A RECEIPT SERIAL / QR TOKEN"
        right={
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="MKO-2026-482913"
              className={`${inputClass} w-64`}
            />
            <button type="button" className={buttonClass} onClick={verify}>
              VERIFY
            </button>
          </>
        }
      >
        {checked === undefined ? (
          <p className="num text-[11px] text-muted-foreground">
            Awaiting input. Verification confirms the receipt exists, is active, and matches a settled
            invoice in this council.
          </p>
        ) : checked === null ? (
          <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-4">
            <div className="num text-[10px] tracking-[0.2em] text-destructive">VERIFICATION FAILED</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              No active receipt found for that serial or token.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="rounded-sm border border-civic/30 bg-civic/5 p-4">
              <div className="flex items-center justify-between">
                <span className="num text-[10px] tracking-[0.2em] text-civic">
                  {checked.status === "ACTIVE" ? "RECEIPT VALID" : "RECEIPT VOIDED"}
                </span>
                <Pill value={checked.status} />
              </div>
              <div className="num mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
                {[
                  ["SERIAL", checked.serial],
                  ["INVOICE", checked.payment?.invoice_no ?? "—"],
                  ["TAXPAYER", checked.payment?.invoice?.taxpayer?.name ?? "—"],
                  ["SOURCE", checked.payment?.invoice?.revenue_source.replace(/_/g, " ") ?? "—"],
                  ["CHANNEL", checked.payment?.channel ?? "—"],
                  ["AMOUNT", `UGX ${ugx(checked.payment?.amount ?? 0)}`],
                  ["ISSUED", `${shortDate(checked.created_at)} ${clockTime(checked.created_at)}`],
                  ["TOKEN", checked.qr_token],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line/60 pb-1">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="truncate text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {(role === "ADMIN" || role === "AUDITOR") && checked.status === "ACTIVE" && (
              <div className="flex items-start">
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => void voidReceipt(checked)}
                >
                  VOID RECEIPT
                </button>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Issued receipts" meta={`${rows.length} SHOWN`} bodyClassName="p-0">
        {receipts.isLoading ? (
          <LoadingRow />
        ) : rows.length === 0 ? (
          <EmptyRow>No receipts issued yet</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Serial", "Invoice", "Taxpayer", "Channel", "Amount", "Issued", "Status"].map((h) => (
                    <th key={h} className="label-mono px-4 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer transition-colors hover:bg-panel2"
                    onClick={() => {
                      setChecked(r);
                      setQ(r.serial);
                    }}
                  >
                    <td className="num px-4 py-2.5 text-[11px] text-civic">{r.serial}</td>
                    <td className="num px-4 py-2.5 text-[11px]">{r.payment?.invoice_no ?? "—"}</td>
                    <td className="px-4 py-2.5 text-[12px]">
                      {r.payment?.invoice?.taxpayer?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "num rounded-sm px-1.5 py-0.5 text-[9px] ring-1",
                          channelTone[r.payment?.channel ?? ""] ??
                            "bg-accent text-muted-foreground ring-border",
                        )}
                      >
                        {r.payment?.channel ?? "—"}
                      </span>
                    </td>
                    <td className="num px-4 py-2.5 text-[12px] font-medium">
                      {ugx(r.payment?.amount ?? 0)}
                    </td>
                    <td className="num px-4 py-2.5 text-[10px] text-muted-foreground">
                      {shortDate(r.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill value={r.status} />
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
