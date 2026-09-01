import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCouncil } from "@/lib/council";
import { useAuth } from "@/lib/auth";
import { compactUgx, shortDate, ugx } from "@/lib/eosr";
import {
  buttonClass,
  EmptyRow,
  Field,
  inputClass,
  Kpi,
  LoadingRow,
  Meter,
  Panel,
  Pill,
} from "@/components/eosr/ui";
import {
  useCanManageCouncil,
  useCouncilBudgets,
  useCouncilMeetings,
  useCouncilSpending,
  useGovernanceMutation,
  useBudgetApproval,
  useCanApproveCouncil,
  BUDGET_STATUS_LABEL,
} from "@/lib/governance";
import { CouncilDocuments } from "@/components/eosr/CouncilDocuments";

export const Route = createFileRoute("/_app/council")({
  head: () => ({
    meta: [
      { title: "Council Profile — Budget, Spending & Meetings | e-OSR" },
      {
        name: "description",
        content:
          "View a Ugandan local council's approved budget, actual spending, upcoming council meetings and official contact details.",
      },
      { property: "og:title", content: "Council Profile — Budget, Spending & Meetings" },
      {
        property: "og:description",
        content: "Council budget allocations, expenditure, meeting calendar and contact details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CouncilPage,
});

const FISCAL_YEAR = "2026/27";

function CouncilPage() {
  const { council } = useCouncil();
  const { profile, user } = useAuth();
  const councilId = council?.id ?? null;

  const budgets = useCouncilBudgets(councilId);
  const spending = useCouncilSpending(councilId);
  const meetings = useCouncilMeetings(councilId);
  const canManage = useCanManageCouncil(councilId);
  const canApprove = useCanApproveCouncil(councilId);
  const approval = useBudgetApproval();

  const addBudget = useGovernanceMutation("council_budgets");
  const addSpending = useGovernanceMutation("council_spending");
  const addMeeting = useGovernanceMutation("council_meetings");

  const totals = useMemo(() => {
    const allocated = (budgets.data ?? [])
      .filter((b) => b.approval_status === "APPROVED")
      .reduce((s, b) => s + Number(b.allocated_amount), 0);
    const spent = (spending.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    return { allocated, spent, balance: allocated - spent };
  }, [budgets.data, spending.data]);

  const perCategory = useMemo(() => {
    const map = new Map<string, { allocated: number; spent: number }>();
    for (const b of (budgets.data ?? []).filter((x) => x.approval_status === "APPROVED"))
      map.set(b.category, {
        allocated: Number(b.allocated_amount),
        spent: map.get(b.category)?.spent ?? 0,
      });
    for (const s of spending.data ?? []) {
      const cur = map.get(s.category) ?? { allocated: 0, spent: 0 };
      map.set(s.category, { allocated: cur.allocated, spent: cur.spent + Number(s.amount) });
    }
    return [...map.entries()];
  }, [budgets.data, spending.data]);

  const upcoming = (meetings.data ?? []).filter((m) => new Date(m.meeting_at) >= new Date());
  const editable = canManage.data === true;
  const approver = canApprove.data === true;
  const pendingCount = (budgets.data ?? []).filter((b) => b.approval_status === "SUBMITTED").length;

  function act(id: string, action: "SUBMIT" | "APPROVE" | "RETURN" | "REOPEN") {
    let note: string | undefined;
    if (action === "RETURN") {
      const reason = window.prompt("Reason for returning this budget line to the council?");
      if (reason === null) return;
      note = reason.trim() || undefined;
    }
    approval.mutate(
      { id, action, ...(note ? { note } : {}) },
      {
        onSuccess: () =>
          toast.success(
            action === "SUBMIT"
              ? "Budget line submitted to the mayor"
              : action === "APPROVE"
                ? "Budget line approved"
                : action === "RETURN"
                  ? "Budget line returned for revision"
                  : "Budget line reopened as draft",
          ),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  if (!council) {
    return <EmptyRow>Select a council from the switcher to view its profile.</EmptyRow>;
  }

  return (
    <div className="space-y-4">
      <Panel
        title={council.name}
        meta={`${council.code} · ${council.district.toUpperCase()} DISTRICT · FY ${FISCAL_YEAR}`}
        right={
          <span className="num rounded-sm border border-line px-2 py-1 text-[10px] tracking-wider text-muted-foreground">
            {editable ? "EDIT ACCESS" : "READ ONLY"}
          </span>
        }
      >
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Physical address", council.physical_address || "—"],
            ["Postal address", council.postal_address || "—"],
            ["Telephone", council.phone || "—"],
            ["Email", council.email || "—"],
            ["Website", council.website || "—"],
            ["Mayor / Chairperson", council.mayor || "—"],
            ["Town clerk", council.town_clerk || "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-sm border border-line bg-panel2 px-3 py-2.5">
              <dt className="label-mono">{label}</dt>
              <dd className="mt-1 text-[13px] break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi label="APPROVED BUDGET" value={compactUgx(totals.allocated)} note={`FY ${FISCAL_YEAR}`} />
        <Kpi
          label="SPENT TO DATE"
          value={compactUgx(totals.spent)}
          tone="warn"
          delta={
            totals.allocated ? `${((totals.spent / totals.allocated) * 100).toFixed(1)}% USED` : "0% USED"
          }
        />
        <Kpi label="UNSPENT BALANCE" value={compactUgx(totals.balance)} note="AVAILABLE" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Budget vs spending by category" meta="APPROVED ALLOCATIONS ONLY">
          {budgets.isLoading ? (
            <LoadingRow />
          ) : perCategory.length === 0 ? (
            <EmptyRow>No approved budget lines yet</EmptyRow>
          ) : (
            <div className="space-y-4">
              {perCategory.map(([cat, v]) => (
                <Meter
                  key={cat}
                  label={cat}
                  amount={v.spent}
                  pct={v.allocated ? (v.spent / v.allocated) * 100 : 0}
                  color="bg-civic"
                  suffix={`of ${ugx(v.allocated)}`}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Upcoming council meetings" meta={`${upcoming.length} SCHEDULED`}>
          {meetings.isLoading ? (
            <LoadingRow />
          ) : upcoming.length === 0 ? (
            <EmptyRow>No meetings scheduled</EmptyRow>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((m) => (
                <li key={m.id} className="rounded-sm border border-line bg-panel2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{m.title}</div>
                      <div className="num mt-1 text-[10px] tracking-wider text-muted-foreground">
                        {new Date(m.meeting_at)
                          .toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                          .toUpperCase()}{" "}
                        · {m.location || "—"}
                      </div>
                      {m.agenda && (
                        <p className="mt-1.5 text-[12px] text-muted-foreground">{m.agenda}</p>
                      )}
                    </div>
                    <Pill value={m.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Budget approval register"
        meta={`FY ${FISCAL_YEAR} · ${pendingCount} AWAITING MAYOR`}
        bodyClassName="p-0"
        right={
          <span className="num rounded-sm border border-line px-2 py-1 text-[10px] tracking-wider text-muted-foreground">
            {approver ? "MAYORAL APPROVAL" : editable ? "SUBMIT ONLY" : "READ ONLY"}
          </span>
        }
      >
        {budgets.isLoading ? (
          <LoadingRow />
        ) : (budgets.data ?? []).length === 0 ? (
          <EmptyRow>No budget lines captured yet</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="label-mono border-b border-line">
                <tr>
                  {["Category", "Allocated (UGX)", "Status", "Submitted", "Reviewed", "Action"].map((h) => (
                    <th key={h} className="px-4 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(budgets.data ?? []).map((b) => (
                  <tr key={b.id} className="border-b border-line/60 last:border-0 align-top">
                    <td className="px-4 py-2.5">
                      {b.category}
                      {b.review_note && (
                        <div className="mt-1 text-[11px] text-destructive">Mayor: {b.review_note}</div>
                      )}
                    </td>
                    <td className="num px-4 py-2.5">{ugx(b.allocated_amount)}</td>
                    <td className="px-4 py-2.5">
                      <Pill value={b.approval_status} />
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {BUDGET_STATUS_LABEL[b.approval_status]}
                      </div>
                    </td>
                    <td className="num px-4 py-2.5 text-muted-foreground">{shortDate(b.submitted_at)}</td>
                    <td className="num px-4 py-2.5 text-muted-foreground">{shortDate(b.reviewed_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {editable && !approver && (b.approval_status === "DRAFT" || b.approval_status === "RETURNED") && (
                          <button
                            className={buttonClass}
                            disabled={approval.isPending}
                            onClick={() => act(b.id, "SUBMIT")}
                          >
                            SUBMIT FOR APPROVAL
                          </button>
                        )}
                        {approver && b.approval_status === "SUBMITTED" && (
                          <>
                            <button
                              className={buttonClass}
                              disabled={approval.isPending}
                              onClick={() => act(b.id, "APPROVE")}
                            >
                              APPROVE
                            </button>
                            <button
                              className={buttonClass}
                              disabled={approval.isPending}
                              onClick={() => act(b.id, "RETURN")}
                            >
                              RETURN
                            </button>
                          </>
                        )}
                        {approver && b.approval_status !== "SUBMITTED" && b.approval_status !== "DRAFT" && (
                          <button
                            className={buttonClass}
                            disabled={approval.isPending}
                            onClick={() => act(b.id, "REOPEN")}
                          >
                            REOPEN
                          </button>
                        )}
                        {!editable && !approver && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Expenditure ledger" meta="RECORDED SPENDING" bodyClassName="p-0">
        {spending.isLoading ? (
          <LoadingRow />
        ) : (spending.data ?? []).length === 0 ? (
          <EmptyRow>No spending recorded</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="label-mono border-b border-line">
                <tr>
                  {["Date", "Category", "Description", "Department", "Amount (UGX)"].map((h) => (
                    <th key={h} className="px-4 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(spending.data ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="num px-4 py-2.5">{shortDate(s.spent_on)}</td>
                    <td className="px-4 py-2.5">{s.category}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.description}</td>
                    <td className="num px-4 py-2.5 text-muted-foreground">{s.department ?? "—"}</td>
                    <td className="num px-4 py-2.5">{ugx(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <CouncilDocuments
        councilId={council.id}
        councilName={council.name}
        editable={editable}
        fiscalYear={FISCAL_YEAR}
        uploadedBy={user?.id ?? null}
      />

      {editable ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel title="Submit budget line" meta="COUNCIL SUBMISSION · DRAFT → MAYOR">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget as HTMLFormElement);
                addBudget.mutate(
                  {
                    council_id: council.id,
                    fiscal_year: String(f.get("fiscal_year") || FISCAL_YEAR),
                    category: String(f.get("category")),
                    allocated_amount: Number(f.get("allocated_amount") || 0),
                    notes: String(f.get("notes") || "") || null,
                    approval_status: "DRAFT",
                  },
                  {
                    onSuccess: () => toast.success("Budget line saved as draft — submit it for mayoral approval"),
                    onError: (err) => toast.error(err.message),
                  },
                );
                (e.currentTarget as HTMLFormElement).reset();
              }}
            >
              <Field label="Fiscal year">
                <input name="fiscal_year" defaultValue={FISCAL_YEAR} className={inputClass} />
              </Field>
              <Field label="Category">
                <input name="category" required className={inputClass} placeholder="Roads & Infrastructure" />
              </Field>
              <Field label="Allocated amount (UGX)">
                <input name="allocated_amount" type="number" min="0" required className={inputClass} />
              </Field>
              <Field label="Notes">
                <input name="notes" className={inputClass} placeholder="Optional" />
              </Field>
              <button type="submit" disabled={addBudget.isPending} className={buttonClass}>
                SAVE BUDGET DRAFT
              </button>
            </form>
          </Panel>

          <Panel title="Record spending" meta="COUNCIL SUBMISSION">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget as HTMLFormElement);
                addSpending.mutate(
                  {
                    council_id: council.id,
                    fiscal_year: String(f.get("fiscal_year") || FISCAL_YEAR),
                    category: String(f.get("category")),
                    description: String(f.get("description") || ""),
                    amount: Number(f.get("amount") || 0),
                    spent_on: String(f.get("spent_on")),
                    department: String(f.get("department") || "") || null,
                  },
                  {
                    onSuccess: () => toast.success("Spending recorded"),
                    onError: (err) => toast.error(err.message),
                  },
                );
                (e.currentTarget as HTMLFormElement).reset();
              }}
            >
              <Field label="Category">
                <input name="category" required className={inputClass} placeholder="Health Services" />
              </Field>
              <Field label="Description">
                <input name="description" required className={inputClass} />
              </Field>
              <Field label="Amount (UGX)">
                <input name="amount" type="number" min="0" required className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input
                    name="spent_on"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Department">
                  <input name="department" className={inputClass} placeholder="Works" />
                </Field>
              </div>
              <input type="hidden" name="fiscal_year" value={FISCAL_YEAR} />
              <button type="submit" disabled={addSpending.isPending} className={buttonClass}>
                RECORD SPENDING
              </button>
            </form>
          </Panel>

          <Panel title="Schedule meeting" meta="COUNCIL SUBMISSION">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget as HTMLFormElement);
                addMeeting.mutate(
                  {
                    council_id: council.id,
                    title: String(f.get("title")),
                    agenda: String(f.get("agenda") || "") || null,
                    meeting_at: new Date(String(f.get("meeting_at"))).toISOString(),
                    location: String(f.get("location") || ""),
                    status: "SCHEDULED",
                  },
                  {
                    onSuccess: () => toast.success("Meeting scheduled"),
                    onError: (err) => toast.error(err.message),
                  },
                );
                (e.currentTarget as HTMLFormElement).reset();
              }}
            >
              <Field label="Title">
                <input name="title" required className={inputClass} placeholder="Finance Committee Sitting" />
              </Field>
              <Field label="Date & time">
                <input name="meeting_at" type="datetime-local" required className={inputClass} />
              </Field>
              <Field label="Location">
                <input name="location" className={inputClass} placeholder="Council Boardroom" />
              </Field>
              <Field label="Agenda">
                <input name="agenda" className={inputClass} placeholder="Optional" />
              </Field>
              <button type="submit" disabled={addMeeting.isPending} className={buttonClass}>
                SCHEDULE MEETING
              </button>
            </form>
          </Panel>
        </div>
      ) : (
        <Panel title="Submissions" meta="RESTRICTED">
          <p className="text-[12px] text-muted-foreground">
            {profile?.council_id || user
              ? "Only a system administrator or the council administrator assigned to this council can submit budgets, spending and meeting dates."
              : "Sign in to submit council records."}
          </p>
        </Panel>
      )}
    </div>
  );
}
