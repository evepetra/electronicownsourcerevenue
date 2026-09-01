import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useCouncil } from "@/lib/council";
import { useInvoices, usePayments, useTaxpayers } from "@/lib/data";
import { buttonClass, Kpi, LoadingRow, Panel } from "@/components/eosr/ui";
import { compactUgx, monthKey, monthLabel, ugx } from "@/lib/eosr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Revenue Reports — e-OSR" },
      {
        name: "description",
        content:
          "Council revenue performance reports: monthly collections, revenue source breakdown, channel analysis and exportable CSV extracts.",
      },
      { property: "og:title", content: "Revenue Reports — e-OSR" },
      {
        property: "og:description",
        content: "Monthly, source and channel revenue performance with CSV export.",
      },
    ],
  }),
  component: ReportsPage,
});

const SLICE_COLORS = [
  "var(--color-civic)",
  "var(--color-violet)",
  "var(--color-sky)",
  "var(--color-warn)",
  "var(--color-destructive)",
];

function toCsv(rows: Record<string, string | number>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "")}"`).join(",")),
  ].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { councilId, council } = useCouncil();
  const invoices = useInvoices(councilId);
  const payments = usePayments(councilId);
  const taxpayers = useTaxpayers(councilId);
  const [view, setView] = useState<"MONTHLY" | "SOURCE" | "CHANNEL">("MONTHLY");

  const model = useMemo(() => {
    const inv = invoices.data ?? [];
    const pay = (payments.data ?? []).filter((p) => p.status === "COMPLETED");

    const byMonth = new Map<string, { billed: number; collected: number }>();
    for (const i of inv) {
      const k = monthKey(i.issued_date);
      const r = byMonth.get(k) ?? { billed: 0, collected: 0 };
      r.billed += Number(i.amount);
      byMonth.set(k, r);
    }
    for (const p of pay) {
      const k = monthKey(p.created_at);
      const r = byMonth.get(k) ?? { billed: 0, collected: 0 };
      r.collected += Number(p.amount);
      byMonth.set(k, r);
    }
    const monthly = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ period: monthLabel(k), key: k, ...v }));

    const bySource = new Map<string, { billed: number; collected: number }>();
    for (const i of inv) {
      const r = bySource.get(i.revenue_source) ?? { billed: 0, collected: 0 };
      r.billed += Number(i.amount);
      bySource.set(i.revenue_source, r);
    }
    for (const p of pay) {
      const src = p.invoice?.revenue_source ?? "OTHER";
      const r = bySource.get(src) ?? { billed: 0, collected: 0 };
      r.collected += Number(p.amount);
      bySource.set(src, r);
    }
    const sources = [...bySource.entries()].map(([source, v]) => ({ source, ...v }));

    const byChannel = new Map<string, { amount: number; count: number }>();
    for (const p of pay) {
      const r = byChannel.get(p.channel) ?? { amount: 0, count: 0 };
      r.amount += Number(p.amount);
      r.count += 1;
      byChannel.set(p.channel, r);
    }
    const channels = [...byChannel.entries()].map(([channel, v]) => ({ channel, ...v }));

    const collected = pay.reduce((s, p) => s + Number(p.amount), 0);
    const billed = inv.reduce((s, i) => s + Number(i.amount), 0);

    return { monthly, sources, channels, collected, billed, txns: pay.length };
  }, [invoices.data, payments.data]);

  function exportCsv() {
    const rows =
      view === "MONTHLY"
        ? model.monthly.map((m) => ({ period: m.key, billed: m.billed, collected: m.collected }))
        : view === "SOURCE"
          ? model.sources.map((s) => ({ source: s.source, billed: s.billed, collected: s.collected }))
          : model.channels.map((c) => ({ channel: c.channel, amount: c.amount, transactions: c.count }));
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    download(`eosr-${(council?.code ?? "osr").toLowerCase()}-${view.toLowerCase()}.csv`, toCsv(rows));
    toast.success("Report exported");
  }

  const loading = invoices.isLoading || payments.isLoading;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Collected" value={compactUgx(model.collected)} note={`${model.txns} transactions`} />
        <Kpi label="Billed" value={compactUgx(model.billed)} tone="warn" note="all invoices" />
        <Kpi
          label="Performance"
          value={model.billed ? ((model.collected / model.billed) * 100).toFixed(1) : "0.0"}
          unit="%"
          note="collection efficiency"
        />
        <Kpi
          label="Registered taxpayers"
          value={String((taxpayers.data ?? []).length)}
          unit="CT"
          note={council?.name ?? ""}
        />
      </div>

      <Panel
        title="Performance report"
        meta={`${view} VIEW · ${council?.name ?? ""}`}
        right={
          <>
            <div className="flex gap-1">
              {(["MONTHLY", "SOURCE", "CHANNEL"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "num rounded-sm px-2 py-1 text-[10px] tracking-wider transition-colors",
                    view === v
                      ? "bg-civic/10 text-civic ring-1 ring-civic/25"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <button type="button" className={buttonClass} onClick={exportCsv}>
              EXPORT CSV
            </button>
          </>
        }
      >
        {loading ? (
          <LoadingRow />
        ) : view === "CHANNEL" ? (
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={model.channels}
                    dataKey="amount"
                    nameKey="channel"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="var(--color-background)"
                  >
                    {model.channels.map((_, i) => (
                      <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                    }}
                    formatter={(v: number) => ugx(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Channel", "Transactions", "Value", "Share"].map((h) => (
                    <th key={h} className="label-mono px-3 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {model.channels.map((c, i) => (
                  <tr key={c.channel}>
                    <td className="num px-3 py-2.5 text-[11px]">
                      <span
                        className="mr-2 inline-block size-2 rounded-xs align-middle"
                        style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                      />
                      {c.channel}
                    </td>
                    <td className="num px-3 py-2.5 text-[11px]">{c.count}</td>
                    <td className="num px-3 py-2.5 text-[12px] font-medium">{ugx(c.amount)}</td>
                    <td className="num px-3 py-2.5 text-[11px] text-muted-foreground">
                      {model.collected ? ((c.amount / model.collected) * 100).toFixed(1) : "0.0"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={view === "MONTHLY" ? model.monthly : model.sources}
                barGap={2}
                margin={{ left: 4, right: 4 }}
              >
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="2 4" />
                <XAxis
                  dataKey={view === "MONTHLY" ? "period" : "source"}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.replace(/_/g, " ")}
                  tick={{ fontSize: 9, fill: "var(--color-muted-foreground)", fontFamily: "var(--font-mono)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  tickFormatter={(v: number) => compactUgx(v)}
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)", fontFamily: "var(--font-mono)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-accent)" }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  formatter={(v: number, n: string) => [ugx(v), n.toUpperCase()]}
                />
                <Bar dataKey="billed" fill="var(--color-violet)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="collected" fill="var(--color-civic)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </>
  );
}
