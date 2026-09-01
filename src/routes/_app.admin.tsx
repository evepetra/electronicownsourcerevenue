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
import { useServerFn } from "@tanstack/react-start";
import {
  createStaffAccount,
  deleteStaffAccount,
  resetStaffPassword,
} from "@/lib/admin.functions";

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
  const createStaff = useServerFn(createStaffAccount);
  const resetPassword = useServerFn(resetStaffPassword);
  const removeStaff = useServerFn(deleteStaffAccount);

  async function handleResetPassword(userId: string, email: string) {
    const next = window.prompt(`New password for ${email} (minimum 8 characters)`);
    if (!next) return;
    if (next.trim().length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      const res = await resetPassword({ data: { userId, password: next.trim() } });
      if (!res.ok) {
        toast.error(res.error ?? "Reset failed");
        return;
      }
      await logAudit({
        actor: profile?.email ?? "system",
        action: "PASSWORD_RESET",
        entity: "auth.users",
        entity_id: userId,
        details: `Password reset for ${email}`,
      });
      toast.success(`Password reset for ${email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  }

  async function handleRemoveStaff(userId: string, email: string) {
    if (!window.confirm(`Remove ${email}? This deletes the account permanently.`)) return;
    try {
      await removeStaff({ data: { userId } });
      await logAudit({
        actor: profile?.email ?? "system",
        action: "STAFF_REMOVED",
        entity: "profiles",
        entity_id: userId,
        details: `Removed ${email}`,
      });
      toast.success(`${email} removed`);
      void qc.invalidateQueries({ queryKey: ["staff"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Removal failed");
    }
  }
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

      <Panel title="Register a council" meta="SYSTEM ADMINISTRATOR ONLY">
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const formEl = e.currentTarget as HTMLFormElement;
            const f = new FormData(formEl);
            const { error } = await supabase.from("councils").insert({
              name: String(f.get("name")),
              code: String(f.get("code")).toUpperCase(),
              district: String(f.get("district")),
              physical_address: String(f.get("physical_address") || ""),
              postal_address: String(f.get("postal_address") || "") || null,
              phone: String(f.get("phone") || ""),
              email: String(f.get("email") || ""),
              website: String(f.get("website") || "") || null,
              mayor: String(f.get("mayor") || "") || null,
              town_clerk: String(f.get("town_clerk") || "") || null,
            });
            if (error) {
              toast.error(error.message);
              return;
            }
            await logAudit({
              actor: profile?.email ?? "admin",
              action: "COUNCIL_CREATED",
              entity: "councils",
              details: String(f.get("name")),
            });
            toast.success("Council registered");
            formEl.reset();
            await qc.invalidateQueries({ queryKey: ["councils"] });
          }}
        >
          <Field label="Council name">
            <input name="name" required className={inputClass} placeholder="Wakiso Town Council" />
          </Field>
          <Field label="Code">
            <input name="code" required maxLength={5} className={inputClass} placeholder="WKS" />
          </Field>
          <Field label="District">
            <input name="district" required className={inputClass} placeholder="Wakiso" />
          </Field>
          <Field label="Telephone">
            <input name="phone" className={inputClass} placeholder="+256 414 000 000" />
          </Field>
          <Field label="Physical address">
            <input name="physical_address" className={inputClass} placeholder="Plot 1, Main Street" />
          </Field>
          <Field label="Postal address">
            <input name="postal_address" className={inputClass} placeholder="P.O. Box 1, Wakiso" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" className={inputClass} placeholder="info@wakisotc.go.ug" />
          </Field>
          <Field label="Website">
            <input name="website" className={inputClass} placeholder="https://…" />
          </Field>
          <Field label="Mayor / Chairperson">
            <input name="mayor" className={inputClass} />
          </Field>
          <Field label="Town clerk">
            <input name="town_clerk" className={inputClass} />
          </Field>
          <div className="flex items-end">
            <button type="submit" className={buttonClass}>
              REGISTER COUNCIL
            </button>
          </div>
        </form>
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

      <Panel title="Create staff account" meta="SYSTEM ADMINISTRATOR ONLY">
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const el = e.currentTarget as HTMLFormElement;
            const f = new FormData(el);
            void (async () => {
              try {
                const res = await createStaff({
                  data: {
                    email: String(f.get("email")),
                    password: String(f.get("password")),
                    fullName: String(f.get("full_name")),
                    staffId: String(f.get("staff_id")),
                    councilId: (String(f.get("council_id")) || null) as string | null,
                    role: String(f.get("role")) as Role,
                  },
                });
                if (!res.ok) {
                  toast.error(res.error ?? "Could not create account");
                  return;
                }
                toast.success("Staff account created");
                el.reset();
                void qc.invalidateQueries({ queryKey: ["staff"] });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not create account");
              }
            })();
          }}
        >
          <Field label="Work email">
            <input name="email" type="email" required className={inputClass} />
          </Field>
          <Field label="Temporary password">
            <input name="password" type="text" minLength={8} required className={inputClass} />
          </Field>
          <Field label="Full name">
            <input name="full_name" required className={inputClass} />
          </Field>
          <Field label="Staff ID">
            <input name="staff_id" required className={inputClass} />
          </Field>
          <Field label="Council">
            <select name="council_id" defaultValue={councilId ?? ""} className={inputClass}>
              <option value="">— none —</option>
              {councils.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Role">
            <select name="role" defaultValue="REVENUE_OFFICER" className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-3">
            <button type="submit" className={buttonClass}>
              CREATE ACCOUNT
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Staff & roles" meta={`${(staff.data ?? []).length} ACCOUNTS`} bodyClassName="p-0">
        {staff.isLoading ? (
          <LoadingRow />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Staff", "Email", "Staff ID", "Role", "Actions"].map((h) => (
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
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleResetPassword(s.id, s.email)}
                          className={ghostButtonClass}
                        >
                          RESET PASSWORD
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemoveStaff(s.id, s.email)}
                          className={ghostButtonClass}
                        >
                          REMOVE
                        </button>
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
