import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCouncil } from "@/lib/council";
import { compactUgx, monthKey, monthLabel, ugx } from "@/lib/eosr";
import { EmptyRow, Kpi, LoadingRow, Meter, Panel, Pill } from "@/components/eosr/ui";
import { useAllGovernance } from "@/lib/governance";

export const Route = createFileRoute("/_app/council-dashboard")({
  head: () => ({
    meta: [
      { title: "Council Dashboard — Budget Progress & Spending Trends | e-OSR" },
      {
        name: "description",
        content:
          "One view of every Ugandan council's budget progress, monthly spending trends and upcoming council meetings.",
      },
      { property: "og:title", content: "Council Dashboard — Budget Progress & Spending Trends" },
      {
        property: "og:description",
        content: "Compare budget utilisation, spending trends and meeting calendars across councils.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CouncilDashboard,
});

function CouncilDashboard() {
  const { councils, council, setCouncilId } = useCouncil();
  const gov = useAllGovernance();

  const rows = useMemo(() => {
    const budgets = gov.data?.budgets ?? [];
    const spending = gov.data?.spending ?? [];
    const meetings = gov.data?.meetings ?? [];
    const now = new Date();
    return councils.map((c) => {
      const allocated = budgets
        .filter((b) => b.council_id === c.id && b.approval_status === "APPROVED")
        .reduce((s, b) => s + Number(b.allocated_amount), 0);
      const spent = spending
        .filter((s2) => s2.council_id === c.id)
        .reduce((s, r) => s + Number(r.amount), 0);
      const upcoming = meetings.filter(
        (m) => m.council_id === c.id && new Date(m.meeting_at) >= now,
      );
      return { council: c, allocated, spent, balance: allocated - spent, upcoming };
    });
  }, [councils, gov.data]);

  const totals = rows.reduce(
    (acc, r) => ({ allocated: acc.allocated + r.allocated, spent: acc.spent + r.spent }),
    { allocated: 0, spent: 0 },
  );

  const trend = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    for (const s of gov.data?.spending ?? []) {
      const key = monthKey(s.spent_on);
      const code = councils.find((c) => c.id === s.council_id)?.code ?? "—";
      const row = map.get(key) ?? { month: monthLabel(key), key };
      row[code] = Number(row[code] ?? 0) + Number(s.amount);
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => String(a["key"]).localeCompare(String(b["key"])));
  }, [gov.data, councils]);

  const compareData = rows.map((r) => ({
    code: r.council.code,
    Allocated: r.allocated,
    Spent: r.spent,
  }));

  const nextMeetings = useMemo(() => {
    const now = new Date();
    return (gov.data?.meetings ?? [])
      .filter((m) => new Date(m.meeting_at) >= now)
      .slice(0, 12)
      .map((m) => ({ ...m, code: councils.find((c) => c.id === m.council_id)?.code ?? "—" }));
  }, [gov.data, councils]);

  const axis = { stroke: "currentColor", fontSize: 10, tickLine: false, axisLine: false } as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Kpi label="COUNCILS TRACKED" value={String(councils.length)} note="MULTI-TENANT" />
        <Kpi label="COMBINED BUDGET" value={compactUgx(totals.allocated)} note="ALL COUNCILS" />
        <Kpi
          label="COMBINED SPENDING"
          value={compactUgx(totals.spent)}
          tone="warn"
          delta={
            totals.allocated ? `${((totals.spent / totals.allocated) * 100).toFixed(1)}% USED` : "0% USED"
          }
        />
        <Kpi
          label="UPCOMING MEETINGS"
          value={String(nextMeetings.length)}
          note="SCHEDULED"
        />
      </div>

      <Panel
        title="Budget progress by council"
        meta="ALLOCATION VS EXPENDITURE"
        right={
          <Link
            to="/council"
            className="num rounded-sm border border-line px-2 py-1 text-[9px] tracking-wider text-muted-foreground hover:text-foreground"
          >
            OPEN COUNCIL PROFILE →
          </Link>
        }
      >
        {gov.isLoading ? (
          <LoadingRow />
        ) : rows.length === 0 ? (
          <EmptyRow>No councils registered</EmptyRow>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <button
                key={r.council.id}
                type="button"
                onClick={() => setCouncilId(r.council.id)}
                className={`block w-full rounded-sm border p-3 text-left transition-colors ${
                  r.council.id === council?.id ? "border-civic/40 bg-civic/5" : "border-line bg-panel2"
                }`}
              >
                <Meter
                  label={`${r.council.code} · ${r.council.name}`}
                  amount={r.spent}
                  pct={r.allocated ? (r.spent / r.allocated) * 100 : 0}
                  color="bg-civic"
                  suffix={`of ${ugx(r.allocated)} · ${r.upcoming.length} upcoming meeting(s)`}
                />
              </button>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Spending trend" meta="MONTHLY EXPENDITURE BY COUNCIL">
          {trend.length === 0 ? (
            <EmptyRow>No spending recorded</EmptyRow>
          ) : (
            <div className="h-72 text-muted-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="2 4" stroke="currentColor" opacity={0.15} />
                  <XAxis dataKey="month" {...axis} />
                  <YAxis {...axis} tickFormatter={(v: number) => compactUgx(v)} width={62} />
                  <Tooltip
                    formatter={(v: number) => ugx(v)}
                    contentStyle={{ fontSize: 11, background: "var(--panel)", border: "1px solid var(--line)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {councils.map((c, i) => (
                    <Line
                      key={c.id}
                      type="monotone"
                      dataKey={c.code}
                      stroke={`oklch(${0.7 - (i % 4) * 0.07} 0.14 ${(i * 57) % 360})`}
                      strokeWidth={1.8}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Allocated vs spent" meta="COUNCIL COMPARISON">
          {compareData.length === 0 ? (
            <EmptyRow>No budgets captured</EmptyRow>
          ) : (
            <div className="h-72 text-muted-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="currentColor" opacity={0.15} />
                  <XAxis dataKey="code" {...axis} />
                  <YAxis {...axis} tickFormatter={(v: number) => compactUgx(v)} width={62} />
                  <Tooltip
                    formatter={(v: number) => ugx(v)}
                    contentStyle={{ fontSize: 11, background: "var(--panel)", border: "1px solid var(--line)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Allocated" fill="oklch(0.65 0.13 250)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Spent" fill="oklch(0.72 0.16 150)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Upcoming council meetings" meta="ALL COUNCILS" bodyClassName="p-0">
        {gov.isLoading ? (
          <LoadingRow />
        ) : nextMeetings.length === 0 ? (
          <EmptyRow>No meetings scheduled</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="label-mono border-b border-line">
                <tr>
                  {["Council", "Date & time", "Title", "Location", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nextMeetings.map((m) => (
                  <tr key={m.id} className="border-b border-line/60 last:border-0">
                    <td className="num px-4 py-2.5">{m.code}</td>
                    <td className="num px-4 py-2.5">
                      {new Date(m.meeting_at)
                        .toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        .toUpperCase()}
                    </td>
                    <td className="px-4 py-2.5">{m.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.location || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Pill value={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
