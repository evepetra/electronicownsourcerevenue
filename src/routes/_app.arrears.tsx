import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCouncil } from "@/lib/council";
import { useAuth } from "@/lib/auth";
import { logAudit, useArrears } from "@/lib/data";
import {
  EmptyRow,
  ghostButtonClass,
  Kpi,
  LoadingRow,
  Meter,
  Panel,
  Pill,
} from "@/components/eosr/ui";
import { compactUgx, shortDate, ugx } from "@/lib/eosr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/arrears")({
  head: () => ({
    meta: [
      { title: "Arrears & Enforcement — e-OSR" },
      {
        name: "description",
        content:
          "Track overdue council revenue by aging bucket, issue reminders to defaulting taxpayers and record approved write-offs.",
      },
      { property: "og:title", content: "Arrears & Enforcement — e-OSR" },
      {
        property: "og:description",
        content: "Aging analysis, reminders and write-offs for overdue council revenue.",
      },
    ],
  }),
  component: ArrearsPage,
});

const BUCKETS = [
  { key: "0-30", min: 0, max: 30 },
  { key: "31-60", min: 31, max: 60 },
  { key: "61-90", min: 61, max: 90 },
  { key: "90+", min: 91, max: Infinity },
];

function ArrearsPage() {
  const { councilId } = useCouncil();
  const { role, profile } = useAuth();
  const qc = useQueryClient();
  const arrears = useArrears(councilId);
  const [bucket, setBucket] = useState("ALL");

  const open = useMemo(
    () => (arrears.data ?? []).filter((a) => a.status !== "WRITTEN_OFF" && a.status !== "SETTLED"),
    [arrears.data],
  );

  const buckets = useMemo(() => {
    const total = open.reduce((s, a) => s + Number(a.outstanding_amount), 0) || 1;
    return BUCKETS.map((b) => {
      const rows = open.filter((a) => a.days_overdue >= b.min && a.days_overdue <= b.max);
      const amount = rows.reduce((s, a) => s + Number(a.outstanding_amount), 0);
      return { ...b, amount, count: rows.length, pct: (amount / total) * 100 };
    });
  }, [open]);

  const rows = useMemo(() => {
    if (bucket === "ALL") return open;
    const b = BUCKETS.find((x) => x.key === bucket);
    if (!b) return open;
    return open.filter((a) => a.days_overdue >= b.min && a.days_overdue <= b.max);
  }, [open, bucket]);

  const outstanding = open.reduce((s, a) => s + Number(a.outstanding_amount), 0);
  const original = open.reduce((s, a) => s + Number(a.original_amount), 0);

  async function writeOff(id: string, invoiceNo: string) {
    const { error } = await supabase
      .from("arrears")
      .update({ status: "WRITTEN_OFF", outstanding_amount: 0 })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      actor: profile?.full_name ?? "staff",
      action: "ARREAR_WRITTEN_OFF",
      entity: "arrears",
      entity_id: invoiceNo,
      details: "Approved write-off",
    });
    toast.success(`Arrear on ${invoiceNo} written off`);
    await qc.invalidateQueries({ queryKey: ["arrears"] });
  }

  async function sendReminder(invoiceNo: string, name: string, phone?: string) {
    await logAudit({
      actor: profile?.full_name ?? "staff",
      action: "ARREAR_REMINDER_SENT",
      entity: "arrears",
      entity_id: invoiceNo,
      details: `SMS reminder queued to ${name}${phone ? ` (${phone})` : ""}`,
    });
    await qc.invalidateQueries({ queryKey: ["audit_logs"] });
    toast.success(`Reminder queued for ${name}`);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Outstanding" value={compactUgx(outstanding)} tone="destructive" note={`${open.length} accounts`} />
        <Kpi label="Originally billed" value={compactUgx(original)} note="on defaulted invoices" />
        <Kpi
          label="Recovery rate"
          value={original ? (((original - outstanding) / original) * 100).toFixed(1) : "0.0"}
          unit="%"
          note="partially recovered"
          tone="warn"
        />
        <Kpi
          label="Beyond 90 days"
          value={String(buckets.find((b) => b.key === "90+")?.count ?? 0)}
          unit="CT"
          tone="destructive"
          note="enforcement candidates"
        />
      </div>

      <Panel title="Aging analysis" meta="OUTSTANDING BY DAYS OVERDUE">
        <div className="grid gap-4 md:grid-cols-2">
          {buckets.map((b) => (
            <Meter
              key={b.key}
              label={`${b.key} DAYS`}
              amount={b.amount}
              pct={b.pct}
              color={
                b.key === "0-30"
                  ? "bg-civic"
                  : b.key === "31-60"
                    ? "bg-warn"
                    : b.key === "61-90"
                      ? "bg-violet"
                      : "bg-destructive"
              }
              suffix={`${b.count} acct`}
            />
          ))}
        </div>
      </Panel>

      <Panel
        title="Defaulting accounts"
        meta={`${rows.length} SHOWN`}
        bodyClassName="p-0"
        right={
          <div className="flex gap-1">
            {["ALL", ...BUCKETS.map((b) => b.key)].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setBucket(k)}
                className={cn(
                  "num rounded-sm px-2 py-1 text-[10px] tracking-wider transition-colors",
                  bucket === k
                    ? "bg-civic/10 text-civic ring-1 ring-civic/25"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {k}
              </button>
            ))}
          </div>
        }
      >
        {arrears.isLoading ? (
          <LoadingRow />
        ) : rows.length === 0 ? (
          <EmptyRow>No arrears in this bucket</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Taxpayer", "Invoice", "Due", "Overdue", "Original", "Outstanding", "Status", "Action"].map(
                    (h) => (
                      <th key={h} className="label-mono px-4 py-2 font-normal">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-panel2">
                    <td className="px-4 py-2.5">
                      <span className="block text-[12px]">{a.taxpayer?.name}</span>
                      <span className="num block text-[10px] text-muted-foreground">
                        {a.taxpayer?.phone}
                      </span>
                    </td>
                    <td className="num px-4 py-2.5 text-[11px] text-civic">{a.invoice_no}</td>
                    <td className="num px-4 py-2.5 text-[11px]">{shortDate(a.due_date)}</td>
                    <td className="num px-4 py-2.5 text-[11px] text-destructive">{a.days_overdue}d</td>
                    <td className="num px-4 py-2.5 text-[11px]">{ugx(a.original_amount)}</td>
                    <td className="num px-4 py-2.5 text-[12px] font-medium text-warn">
                      {ugx(a.outstanding_amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill value={a.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className={ghostButtonClass}
                          onClick={() =>
                            void sendReminder(a.invoice_no, a.taxpayer?.name ?? "taxpayer", a.taxpayer?.phone)
                          }
                        >
                          REMIND
                        </button>
                        {role === "ADMIN" && (
                          <button
                            type="button"
                            className={ghostButtonClass}
                            onClick={() => void writeOff(a.id, a.invoice_no)}
                          >
                            WRITE OFF
                          </button>
                        )}
                      </div>
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
