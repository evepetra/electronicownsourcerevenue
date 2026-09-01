import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCouncil } from "@/lib/council";
import { useArrears, useInvoices, usePayments, useTaxpayers } from "@/lib/data";
import { Kpi, LoadingRow, Meter, Panel, Pill } from "@/components/eosr/ui";
import {
  channelTone,
  clockTime,
  compactUgx,
  monthKey,
  monthLabel,
  shortDate,
  sourceTone,
  ugx,
} from "@/lib/eosr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Revenue Command Dashboard — e-OSR" },
      {
        name: "description",
        content:
          "Live own source revenue command surface: collections, billing coverage, channel split, arrears exposure and the transaction ledger for your council.",
      },
      { property: "og:title", content: "Revenue Command Dashboard — e-OSR" },
      {
        property: "og:description",
        content: "Live collections, channel split, arrears exposure and transaction ledger.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { councilId, council } = useCouncil();
  const invoices = useInvoices(councilId);
  const payments = usePayments(councilId);
  const arrears = useArrears(councilId);
  const taxpayers = useTaxpayers(councilId);

  const stats = useMemo(() => {
    const inv = invoices.data ?? [];
    const pay = (payments.data ?? []).filter((p) => p.status === "COMPLETED");
    const arr = arrears.data ?? [];

    const invoiced = inv.reduce((s, i) => s + Number(i.amount), 0);
    const collected = pay.reduce((s, p) => s + Number(p.amount), 0);
    const outstanding = arr
      .filter((a) => a.status !== "WRITTEN_OFF")
      .reduce((s, a) => s + Number(a.outstanding_amount), 0);
    const rate = invoiced ? (collected / invoiced) * 100 : 0;

    const byMonth = new Map<string, { invoiced: number; collected: number }>();
    for (const i of inv) {
      const k = monthKey(i.issued_date);
      const row = byMonth.get(k) ?? { invoiced: 0, collected: 0 };
      row.invoiced += Number(i.amount);
      byMonth.set(k, row);
    }
    for (const p of pay) {
      const k = monthKey(p.created_at);
      const row = byMonth.get(k) ?? { invoiced: 0, collected: 0 };
      row.collected += Number(p.amount);
      byMonth.set(k, row);
    }
    const trend = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([k, v]) => ({ month: monthLabel(k), ...v }));

    const bySource = new Map<string, number>();
    for (const i of inv) bySource.set(i.revenue_source, (bySource.get(i.revenue_source) ?? 0) + Number(i.amount));
    const sources = [...bySource.entries()]
      .map(([source, amount]) => ({ source, amount, pct: invoiced ? (amount / invoiced) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);

    const byChannel = new Map<string, { amount: number; count: number }>();
    for (const p of pay) {
      const row = byChannel.get(p.channel) ?? { amount: 0, count: 0 };
      row.amount += Number(p.amount);
      row.count += 1;
      byChannel.set(p.channel, row);
    }
    const channels = [...byChannel.entries()]
      .map(([channel, v]) => ({
        channel,
        ...v,
        pct: collected ? (v.amount / collected) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const defaulters = [...arr]
      .filter((a) => a.status !== "WRITTEN_OFF")
      .sort((a, b) => Number(b.outstanding_amount) - Number(a.outstanding_amount))
      .slice(0, 6);

    return {
      invoiced,
      collected,
      outstanding,
      rate,
      trend,
      sources,
      channels,
      defaulters,
      unpaid: inv.filter((i) => i.status !== "PAID").length,
      ledger: (payments.data ?? []).slice(0, 12),
    };
  }, [invoices.data, payments.data, arrears.data]);

  const loading = invoices.isLoading || payments.isLoading || arrears.isLoading;
  const activeTaxpayers = (taxpayers.data ?? []).filter((t) => t.is_active).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {council?.name ?? "Council"} — revenue command
          </h1>
          <p className="num mt-1 text-[10px] tracking-[0.2em] text-muted-foreground">
            FISCAL POSITION · ALL FIGURES IN UGANDA SHILLINGS
          </p>
        </div>
        <div className="num flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="rounded-sm border border-line bg-panel px-2 py-1">
            {(invoices.data ?? []).length} INVOICES
          </span>
          <span className="rounded-sm border border-line bg-panel px-2 py-1">
            {(payments.data ?? []).length} PAYMENTS
          </span>
          <span className="rounded-sm border border-line bg-panel px-2 py-1">
            {activeTaxpayers} ACTIVE TAXPAYERS
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label="Collected to date"
          value={compactUgx(stats.collected)}
          delta={`${stats.rate.toFixed(1)}% of billed`}
          note={`${(stats.channels ?? []).length} channels`}
        />
        <Kpi
          label="Total billed"
          value={compactUgx(stats.invoiced)}
          delta={`${stats.unpaid} open`}
          note="invoices raised"
          tone="warn"
        />
        <Kpi
          label="Arrears exposure"
          value={compactUgx(stats.outstanding)}
          delta={`${(arrears.data ?? []).length} accounts`}
          note="outstanding"
          tone="destructive"
        />
        <Kpi
          label="Collection rate"
          value={`${stats.rate.toFixed(1)}`}
          unit="%"
          delta={stats.rate >= 70 ? "ON TARGET" : "BELOW TARGET"}
          note="billed vs settled"
          tone={stats.rate >= 70 ? "civic" : "warn"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Billed vs collected"
          meta="MONTHLY · LAST 8 PERIODS"
          right={
            <span className="num flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-xs bg-civic" /> COLLECTED
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-xs bg-violet" /> BILLED
              </span>
            </span>
          }
        >
          {loading ? (
            <LoadingRow />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.trend} barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="2 4" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)", fontFamily: "var(--font-mono)" }}
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
                  <Bar dataKey="invoiced" name="billed" fill="var(--color-violet)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="collected" name="collected" fill="var(--color-civic)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Revenue source mix" meta="SHARE OF TOTAL BILLED">
          {loading ? (
            <LoadingRow />
          ) : (
            <div className="space-y-4">
              {stats.sources.map((s) => (
                <Meter
                  key={s.source}
                  label={s.source}
                  amount={s.amount}
                  pct={s.pct}
                  color={sourceTone[s.source] ?? "bg-civic"}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <div className="space-y-4">
          <Panel title="Collection channels" meta="SETTLED VALUE BY CHANNEL">
            {loading ? (
              <LoadingRow />
            ) : (
              <div className="space-y-4">
                {stats.channels.map((c) => (
                  <Meter
                    key={c.channel}
                    label={c.channel}
                    amount={c.amount}
                    pct={c.pct}
                    color={
                      c.channel === "MOMO" ? "bg-civic" : c.channel === "USSD" ? "bg-violet" : "bg-sky"
                    }
                    suffix={`${c.count} txn`}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Collection momentum" meta="CUMULATIVE SETTLEMENT CURVE" bodyClassName="p-2 pt-3">
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trend}>
                  <defs>
                    <linearGradient id="civicFade" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-civic)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-civic)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" hide />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                    }}
                    formatter={(v: number) => [ugx(v), "COLLECTED"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    stroke="var(--color-civic)"
                    strokeWidth={1.5}
                    fill="url(#civicFade)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <Panel
          title="Live transaction ledger"
          meta="MOST RECENT SETTLEMENTS"
          bodyClassName="p-0"
          right={<span className="num text-[10px] text-civic">● STREAMING</span>}
        >
          {loading ? (
            <LoadingRow />
          ) : (
            <div className="divide-y divide-line">
              {stats.ledger.map((p, i) => (
                <div
                  key={p.id}
                  className="slidein grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5"
                  style={{ animationDelay: `${i * 25}ms` }}
                >
                  <span className="num text-[10px] text-muted-foreground">{clockTime(p.created_at)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px]">
                      {p.invoice?.taxpayer?.name ?? "Unknown taxpayer"}
                    </span>
                    <span className="num block text-[10px] text-muted-foreground">
                      {p.invoice_no} · {p.invoice?.revenue_source.replace(/_/g, " ") ?? "—"} ·{" "}
                      {shortDate(p.created_at)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "num rounded-sm px-1.5 py-0.5 text-[9px] ring-1",
                        channelTone[p.channel] ?? "bg-accent text-muted-foreground ring-border",
                      )}
                    >
                      {p.channel}
                    </span>
                    <span className="num text-[12px] font-medium">{ugx(p.amount)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Top arrears exposure" meta="HIGHEST OUTSTANDING BALANCES" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-line">
                {["Taxpayer", "Invoice", "Original", "Outstanding", "Overdue", "Status"].map((h) => (
                  <th key={h} className="label-mono px-4 py-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.defaulters.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-panel2">
                  <td className="px-4 py-2.5">
                    <span className="block text-[12px]">{a.taxpayer?.name}</span>
                    <span className="num block text-[10px] text-muted-foreground">
                      {a.taxpayer?.taxpayer_code}
                    </span>
                  </td>
                  <td className="num px-4 py-2.5 text-[11px]">{a.invoice_no}</td>
                  <td className="num px-4 py-2.5 text-[11px]">{ugx(a.original_amount)}</td>
                  <td className="num px-4 py-2.5 text-[12px] font-medium text-warn">
                    {ugx(a.outstanding_amount)}
                  </td>
                  <td className="num px-4 py-2.5 text-[11px] text-destructive">{a.days_overdue}d</td>
                  <td className="px-4 py-2.5">
                    <Pill value={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
