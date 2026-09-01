import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCouncil } from "@/lib/council";
import { useAuth } from "@/lib/auth";
import { logAudit, useFeeSchedules } from "@/lib/data";
import {
  buttonClass,
  EmptyRow,
  Field,
  ghostButtonClass,
  inputClass,
  LoadingRow,
  Panel,
  Pill,
} from "@/components/eosr/ui";
import { REVENUE_SOURCES, ROLES, ugx, type Role } from "@/lib/eosr";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Administration — e-OSR" },
      {
        name: "description",
        content:
          "Administer council fee schedules, staff roles and multi-council configuration for the own source revenue platform.",
      },
      { property: "og:title", content: "Administration — e-OSR" },
      {
        property: "og:description",
        content: "Fee schedules, staff roles and council configuration.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { councilId, councils, council } = useCouncil();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const fees = useFeeSchedules(councilId);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    revenue_source: REVENUE_SOURCES[0] as string,
    description: "",
    amount: "",
    period: "MONTHLY",
  });

  const staff = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as Role]));
      return (profiles ?? []).map((p) => ({
        ...(p as { id: string; email: string; full_name: string; staff_id: string; council_id: string | null }),
        role: roleMap.get(p.id) ?? null,
      }));
    },
  });

  async function addFee(e: React.FormEvent) {
    e.preventDefault();
    if (!councilId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("fee_schedules").insert({
        council_id: councilId,
        revenue_source: form.revenue_source,
        description: form.description,
        amount: Number(form.amount || 0),
        period: form.period,
        is_active: true,
      });
      if (error) throw error;
      await logAudit({
        actor: profile?.full_name ?? "admin",
        action: "FEE_SCHEDULE_CREATED",
        entity: "fee_schedules",
        details: `${form.revenue_source} · ${form.description} · UGX ${ugx(form.amount)}`,
      });
      toast.success("Fee item added");
      setForm({ ...form, description: "", amount: "" });
      await qc.invalidateQueries({ queryKey: ["fee_schedules"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add fee item");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFee(id: string, next: boolean) {
    const { error } = await supabase.from("fee_schedules").update({ is_active: next }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["fee_schedules"] });
  }

  async function setRole(userId: string, role: Role) {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      actor: profile?.full_name ?? "admin",
      action: "ROLE_ASSIGNED",
      entity: "user_roles",
      entity_id: userId,
      details: `Role set to ${role}`,
    });
    toast.success(`Role updated to ${role.replace(/_/g, " ")}`);
    await qc.invalidateQueries({ queryKey: ["staff"] });
  }

  return (
    <>
      <Panel title="Council configuration" meta="MULTI-COUNCIL DEPLOYMENT">
        <div className="grid gap-3 sm:grid-cols-3">
          {councils.map((c) => (
            <div
              key={c.id}
              className="rounded-sm border border-line bg-panel2 p-3"
            >
              <div className="num text-[10px] tracking-[0.2em] text-civic">{c.code}</div>
              <div className="mt-1 text-[13px]">{c.name}</div>
              <div className="num mt-0.5 text-[10px] text-muted-foreground">
                {c.district.toUpperCase()} DISTRICT {c.id === council?.id ? "· ACTIVE" : ""}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Fee schedule" meta={`${(fees.data ?? []).length} ITEMS · ${council?.name ?? ""}`} bodyClassName="p-0">
        <form onSubmit={addFee} className="grid gap-3 border-b border-line p-4 md:grid-cols-5">
          <Field label="Revenue source">
            <select
              value={form.revenue_source}
              onChange={(e) => setForm({ ...form, revenue_source: e.target.value })}
              className={inputClass}
            >
              {REVENUE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Amount (UGX)">
            <input
              required
              inputMode="numeric"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Period">
            <select
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
              className={inputClass}
            >
              {["DAILY", "MONTHLY", "QUARTERLY", "ANNUAL"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button type="submit" disabled={busy} className={buttonClass}>
              {busy ? "SAVING…" : "ADD FEE ITEM"}
            </button>
          </div>
        </form>

        {fees.isLoading ? (
          <LoadingRow />
        ) : (fees.data ?? []).length === 0 ? (
          <EmptyRow>No fee items configured</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Source", "Description", "Amount", "Period", "Status", ""].map((h) => (
                    <th key={h} className="label-mono px-4 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(fees.data ?? []).map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-panel2">
                    <td className="num px-4 py-2.5 text-[11px] text-civic">
                      {f.revenue_source.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2.5 text-[12px]">{f.description}</td>
                    <td className="num px-4 py-2.5 text-[12px] font-medium">{ugx(f.amount)}</td>
                    <td className="num px-4 py-2.5 text-[11px] text-muted-foreground">{f.period}</td>
                    <td className="px-4 py-2.5">
                      <Pill value={f.is_active ? "ACTIVE" : "VOIDED"} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        className={ghostButtonClass}
                        onClick={() => void toggleFee(f.id, !f.is_active)}
                      >
                        {f.is_active ? "DISABLE" : "ENABLE"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Staff & roles" meta={`${(staff.data ?? []).length} ACCOUNTS`} bodyClassName="p-0">
        {staff.isLoading ? (
          <LoadingRow />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Staff", "Email", "Staff ID", "Role"].map((h) => (
                    <th key={h} className="label-mono px-4 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(staff.data ?? []).map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-panel2">
                    <td className="px-4 py-2.5 text-[12px]">{s.full_name}</td>
                    <td className="num px-4 py-2.5 text-[11px] text-muted-foreground">{s.email}</td>
                    <td className="num px-4 py-2.5 text-[11px]">{s.staff_id}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={s.role ?? ""}
                        onChange={(e) => void setRole(s.id, e.target.value as Role)}
                        className={`${inputClass} h-8 w-44`}
                      >
                        <option value="">— unassigned —</option>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
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
