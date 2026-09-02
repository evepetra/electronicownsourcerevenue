import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCouncil } from "@/lib/council";
import { compactUgx, ugx } from "@/lib/eosr";
import { EmptyRow, Kpi, LoadingRow, Meter, Panel } from "@/components/eosr/ui";
import { useAllGovernance } from "@/lib/governance";

export const Route = createFileRoute("/_app/council-performance")({
  head: () => ({
    meta: [
      { title: "Council Performance — Approval Rate, On-Time Spend & Attendance | e-OSR" },
      {
        name: "description",
        content:
          "Track every council's budget approval rate, on-time expenditure, budget absorption and council meeting attendance in one scorecard for mayors.",
      },
      { property: "og:title", content: "Council Performance Scorecard" },
      {
        property: "og:description",
        content:
          "Budget approval rate, on-time spending, absorption and meeting attendance metrics for Ugandan local councils.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CouncilPerformance,
});

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function CouncilPerformance() {
  const { councils, council, setCouncilId } = useCouncil();
  const gov = useAllGovernance();

  const rows = useMemo(() => {
    const budgets = gov.data?.budgets ?? [];
    const spending = gov.data?.spending ?? [];
    const meetings = gov.data?.meetings ?? [];

    return councils.map((c) => {
      const b = budgets.filter((x) => x.council_id === c.id);
      const approvedLines = b.filter((x) => x.approval_status === "APPROVED");
      const approvalRate = pct(approvedLines.length, b.length);
      const allocated = approvedLines.reduce((s, x) => s + Number(x.allocated_amount), 0);
      const pending = b.filter((x) => x.approval_status === "SUBMITTED").length;

      const s = spending.filter((x) => x.council_id === c.id);
      const spent = s.reduce((t, x) => t + Number(x.amount), 0);
      const dated = s.filter((x) => !!x.planned_on);
      const onTime = dated.filter((x) => x.spent_on <= (x.planned_on as string));
      const onTimeRate = pct(onTime.length, dated.length);

      const held = meetings.filter((m) => m.council_id === c.id && m.attendees_present !== null);
      const present = held.reduce((t, m) => t + Number(m.attendees_present ?? 0), 0);
      const expected = held.reduce((t, m) => t + Number(m.expected_attendees ?? 0), 0);
      const attendanceRate = pct(present, expected);

      const absorption = pct(spent, allocated);
      const score = (approvalRate + onTimeRate + attendanceRate + Math.min(absorption, 100)) / 4;

      return {
        council: c,
        lines: b.length,
        approvedLines: approvedLines.length,
        pending,
        approvalRate,
        allocated,
        spent,
        onTimeRate,
        onTimeCount: onTime.length,
        datedCount: dated.length,
        attendanceRate,
        heldCount: held.length,
        absorption,
        score,
      };
    });
  }, [councils, gov.data]);

  const overall = useMemo(() => {
    const n = rows.length || 1;
    return {
      approval: rows.reduce((s, r) => s + r.approvalRate, 0) / n,
      onTime: rows.reduce((s, r) => s + r.onTimeRate, 0) / n,
      attendance: rows.reduce((s, r) => s + r.attendanceRate, 0) / n,
      absorption: pct(
        rows.reduce((s, r) => s + r.spent, 0),
        rows.reduce((s, r) => s + r.allocated, 0),
      ),
      pending: rows.reduce((s, r) => s + r.pending, 0),
    };
  }, [rows]);

  const chart = rows.map((r) => ({
    code: r.council.code,
    Approval: Number(r.approvalRate.toFixed(1)),
    "On-time spend": Number(r.onTimeRate.toFixed(1)),
    Attendance: Number(r.attendanceRate.toFixed(1)),
    Absorption: Number(r.absorption.toFixed(1)),
  }));

  const axis = { stroke: "currentColor", fontSize: 10, tickLine: false, axisLine: false } as const;

  if (gov.isLoading) return <LoadingRow />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Kpi
          label="BUDGET APPROVAL RATE"
          value={fmtPct(overall.approval)}
          note={`${overall.pending} LINES AWAITING MAYOR`}
        />
        <Kpi label="SPENDING ON TIME" value={fmtPct(overall.onTime)} tone="warn" note="PAID BY PLANNED DATE" />
        <Kpi label="MEETING ATTENDANCE" value={fmtPct(overall.attendance)} note="MEMBERS PRESENT VS EXPECTED" />
        <Kpi label="BUDGET ABSORPTION" value={fmtPct(overall.absorption)} note="SPENT VS APPROVED" />
      </div>

      <Panel title="Performance by council" meta="ALL METRICS · PERCENTAGE">
        {chart.length === 0 ? (
          <EmptyRow>No councils registered</EmptyRow>
        ) : (
          <div className="h-80 text-muted-foreground">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="2 4" stroke="currentColor" opacity={0.15} />
                <XAxis dataKey="code" {...axis} />
                <YAxis {...axis} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip
                  formatter={(v: number) => `${v}%`}
                  contentStyle={{ fontSize: 11, background: "var(--panel)", border: "1px solid var(--line)" }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Approval" fill="oklch(0.65 0.13 250)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="On-time spend" fill="oklch(0.72 0.16 150)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Attendance" fill="oklch(0.75 0.15 80)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Absorption" fill="oklch(0.68 0.14 20)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Council scorecard" meta="FY 2026/27" bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyRow>No councils registered</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="label-mono border-b border-line">
                <tr>
                  {[
                    "Council",
                    "Approved budget",
                    "Spent",
                    "Approval rate",
                    "On time",
                    "Attendance",
                    "Absorption",
                    "Score",
                  ].map((h) => (
                    <th key={h} className="px-4 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => b.score - a.score)
                  .map((r) => (
                    <tr
                      key={r.council.id}
                      onClick={() => setCouncilId(r.council.id)}
                      className={`cursor-pointer border-b border-line/60 last:border-0 ${
                        r.council.id === council?.id ? "bg-civic/5" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <span className="num">{r.council.code}</span>{" "}
                        <span className="text-muted-foreground">{r.council.name}</span>
                      </td>
                      <td className="num px-4 py-2.5">{compactUgx(r.allocated)}</td>
                      <td className="num px-4 py-2.5">{compactUgx(r.spent)}</td>
                      <td className="num px-4 py-2.5">
                        {fmtPct(r.approvalRate)}{" "}
                        <span className="text-muted-foreground">
                          ({r.approvedLines}/{r.lines})
                        </span>
                      </td>
                      <td className="num px-4 py-2.5">
                        {fmtPct(r.onTimeRate)}{" "}
                        <span className="text-muted-foreground">
                          ({r.onTimeCount}/{r.datedCount})
                        </span>
                      </td>
                      <td className="num px-4 py-2.5">
                        {fmtPct(r.attendanceRate)}{" "}
                        <span className="text-muted-foreground">({r.heldCount} held)</span>
                      </td>
                      <td className="num px-4 py-2.5">{fmtPct(r.absorption)}</td>
                      <td className="num px-4 py-2.5 font-medium">{r.score.toFixed(0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {council && (
        <Panel
          title={`${council.name} — metric detail`}
          meta="SELECTED COUNCIL"
          right={
            <span className="num rounded-sm border border-line px-2 py-1 text-[10px] tracking-wider text-muted-foreground">
              {council.code}
            </span>
          }
        >
          {(() => {
            const r = rows.find((x) => x.council.id === council.id);
            if (!r) return <EmptyRow>No data for this council</EmptyRow>;
            return (
              <div className="space-y-4">
                <Meter
                  label="Budget approval rate"
                  amount={r.approvedLines}
                  pct={r.approvalRate}
                  color="bg-civic"
                  suffix={`${r.approvedLines} of ${r.lines} budget lines approved · ${r.pending} awaiting mayor`}
                />
                <Meter
                  label="Spending on time"
                  amount={r.onTimeCount}
                  pct={r.onTimeRate}
                  color="bg-civic"
                  suffix={`${r.onTimeCount} of ${r.datedCount} payments made by their planned date`}
                />
                <Meter
                  label="Meeting attendance"
                  amount={r.heldCount}
                  pct={r.attendanceRate}
                  color="bg-civic"
                  suffix={`${r.heldCount} meeting(s) held with attendance recorded`}
                />
                <Meter
                  label="Budget absorption"
                  amount={r.spent}
                  pct={r.absorption}
                  color="bg-civic"
                  suffix={`of ${ugx(r.allocated)} approved`}
                />
              </div>
            );
          })()}
        </Panel>
      )}
    </div>
  );
}
