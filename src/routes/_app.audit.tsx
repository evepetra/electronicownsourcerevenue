import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuditLogs } from "@/lib/data";
import { EmptyRow, inputClass, Kpi, LoadingRow, Panel } from "@/components/eosr/ui";
import { clockTime, shortDate } from "@/lib/eosr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — e-OSR" },
      {
        name: "description",
        content:
          "Append-only audit trail of every registration, invoice, payment, receipt void and reconciliation action taken in the revenue system.",
      },
      { property: "og:title", content: "Audit Trail — e-OSR" },
      {
        property: "og:description",
        content: "Immutable record of all council revenue system activity.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const logs = useAuditLogs(300);
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("ALL");

  const entities = useMemo(
    () => ["ALL", ...new Set((logs.data ?? []).map((l) => l.entity))],
    [logs.data],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (logs.data ?? []).filter((l) => {
      if (entity !== "ALL" && l.entity !== entity) return false;
      if (!needle) return true;
      return [l.actor, l.action, l.entity, l.entity_id ?? "", l.details ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [logs.data, q, entity]);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = (logs.data ?? []).filter((l) => l.created_at.startsWith(today)).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Recorded events" value={String((logs.data ?? []).length)} unit="CT" note="most recent 300" />
        <Kpi label="Events today" value={String(todayCount)} unit="CT" note="since midnight" />
        <Kpi
          label="Distinct actors"
          value={String(new Set((logs.data ?? []).map((l) => l.actor)).size)}
          unit="CT"
          note="staff & system"
        />
        <Kpi label="Entities tracked" value={String(entities.length - 1)} unit="CT" note="tables under audit" />
      </div>

      <Panel
        title="Audit trail"
        meta={`${rows.length} EVENTS · APPEND-ONLY`}
        bodyClassName="p-0"
        right={
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search actor, action, reference…"
              className={`${inputClass} w-60`}
            />
          </>
        }
      >
        <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2">
          {entities.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEntity(e)}
              className={cn(
                "num rounded-sm px-2 py-1 text-[10px] tracking-wider transition-colors",
                entity === e
                  ? "bg-civic/10 text-civic ring-1 ring-civic/25"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {e.toUpperCase()}
            </button>
          ))}
        </div>

        {logs.isLoading ? (
          <LoadingRow />
        ) : rows.length === 0 ? (
          <EmptyRow>No audit events match this filter</EmptyRow>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((l) => (
              <div key={l.id} className="grid grid-cols-[auto_1fr] gap-3 px-4 py-2.5">
                <span className="num text-[10px] whitespace-nowrap text-muted-foreground">
                  {shortDate(l.created_at)} {clockTime(l.created_at)}
                </span>
                <span className="min-w-0">
                  <span className="num text-[11px] text-civic">{l.action}</span>
                  <span className="num ml-2 text-[10px] text-muted-foreground">
                    {l.entity}
                    {l.entity_id ? ` · ${l.entity_id}` : ""}
                  </span>
                  <span className="block truncate text-[12px]">
                    {l.details ?? "—"}{" "}
                    <span className="num text-[10px] text-muted-foreground">by {l.actor}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
