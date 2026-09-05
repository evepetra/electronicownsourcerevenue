import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCouncil } from "@/lib/council";
import { useAuth } from "@/lib/auth";
import { logAudit, usePremises, useTaxpayers } from "@/lib/data";
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
import { shortDate } from "@/lib/eosr";

export const Route = createFileRoute("/_app/taxpayers")({
  head: () => ({
    meta: [
      { title: "Taxpayer Register — e-OSR" },
      {
        name: "description",
        content:
          "Digitised taxpayer register: businesses, market vendors and property owners with premises, contacts and compliance status.",
      },
      { property: "og:title", content: "Taxpayer Register — e-OSR" },
      {
        property: "og:description",
        content: "Register, search and maintain council taxpayers and their premises.",
      },
    ],
  }),
  component: TaxpayersPage,
});

const TYPES = ["BUSINESS", "INDIVIDUAL", "MARKET_VENDOR", "PROPERTY_OWNER"];

function TaxpayersPage() {
  const { councilId, council, councils } = useCouncil();
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const taxpayers = useTaxpayers(councilId);
  const premises = usePremises();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formCouncilId, setFormCouncilId] = useState<string>("");

  useEffect(() => {
    if (councilId && !formCouncilId) setFormCouncilId(councilId);
  }, [councilId, formCouncilId]);

  const formCouncil = councils.find((c) => c.id === formCouncilId) ?? council;
  const [form, setForm] = useState({
    name: "",
    type: "BUSINESS",
    phone: "",
    email: "",
    tin: "",
    nin: "",
    location: "",
    address: "",
  });

  const premiseCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of premises.data ?? []) map.set(p.taxpayer_id, (map.get(p.taxpayer_id) ?? 0) + 1);
    return map;
  }, [premises.data]);

  const rows = useMemo(() => {
    const list = taxpayers.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((t) =>
      [t.name, t.taxpayer_code, t.phone, t.tin ?? "", t.location ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [taxpayers.data, q]);

  async function createTaxpayer(e: React.FormEvent) {
    e.preventDefault();
    if (!councilId) return;
    setBusy(true);
    try {
      const seq = (taxpayers.data?.length ?? 0) + 1;
      const code = `${council?.code ?? "OSR"}-TP-${String(seq).padStart(4, "0")}-${Math.floor(Math.random() * 90 + 10)}`;
      const { error } = await supabase.from("taxpayers").insert({
        taxpayer_code: code,
        name: form.name,
        type: form.type,
        phone: form.phone,
        email: form.email || null,
        tin: form.tin || null,
        nin: form.nin || null,
        location: form.location || null,
        address: form.address || null,
        council_id: councilId,
      });
      if (error) throw error;
      await logAudit({
        actor: profile?.full_name ?? user?.email ?? "staff",
        action: "TAXPAYER_REGISTERED",
        entity: "taxpayers",
        entity_id: code,
        details: `${form.name} registered in ${council?.name}`,
      });
      toast.success(`Taxpayer ${code} registered`);
      setForm({
        name: "",
        type: "BUSINESS",
        phone: "",
        email: "",
        tin: "",
        nin: "",
        location: "",
        address: "",
      });
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["taxpayers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not register taxpayer");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    const { error } = await supabase.from("taxpayers").update({ is_active: next }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      actor: profile?.full_name ?? "staff",
      action: next ? "TAXPAYER_REACTIVATED" : "TAXPAYER_DEACTIVATED",
      entity: "taxpayers",
      entity_id: id,
    });
    await qc.invalidateQueries({ queryKey: ["taxpayers"] });
  }

  return (
    <>
      <Panel
        title="Taxpayer register"
        meta={`${rows.length} RECORDS · ${council?.name ?? ""}`}
        right={
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, code, TIN…"
              className={`${inputClass} w-56`}
            />
            <button type="button" className={buttonClass} onClick={() => setOpen((v) => !v)}>
              {open ? "CLOSE" : "+ REGISTER"}
            </button>
          </>
        }
        bodyClassName="p-0"
      >
        {open && (
          <form onSubmit={createTaxpayer} className="grid gap-3 border-b border-line p-4 md:grid-cols-4">
            <Field label="Name">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className={inputClass}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone">
              <input
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
                placeholder="+256 7xx xxx xxx"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="TIN">
              <input
                value={form.tin}
                onChange={(e) => setForm({ ...form, tin: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="NIN">
              <input
                value={form.nin}
                onChange={(e) => setForm({ ...form, nin: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Location / market">
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="flex items-end">
              <button disabled={busy} className={buttonClass} type="submit">
                {busy ? "SAVING…" : "SAVE TAXPAYER"}
              </button>
            </div>
          </form>
        )}

        {taxpayers.isLoading ? (
          <LoadingRow />
        ) : rows.length === 0 ? (
          <EmptyRow>No taxpayers match this search</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Code", "Taxpayer", "Type", "Contact", "Premises", "Registered", "Status", ""].map(
                    (h) => (
                      <th key={h} className="label-mono px-4 py-2 font-normal">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-panel2">
                    <td className="num px-4 py-2.5 text-[11px] text-civic">{t.taxpayer_code}</td>
                    <td className="px-4 py-2.5">
                      <span className="block text-[12px]">{t.name}</span>
                      <span className="num block text-[10px] text-muted-foreground">
                        {t.location ?? t.address ?? "—"}
                      </span>
                    </td>
                    <td className="num px-4 py-2.5 text-[11px] text-muted-foreground">
                      {t.type.replace(/_/g, " ")}
                    </td>
                    <td className="num px-4 py-2.5 text-[11px]">{t.phone}</td>
                    <td className="num px-4 py-2.5 text-[11px]">{premiseCount.get(t.id) ?? 0}</td>
                    <td className="num px-4 py-2.5 text-[11px] text-muted-foreground">
                      {shortDate(t.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill value={t.is_active ? "ACTIVE" : "VOIDED"} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        className={ghostButtonClass}
                        onClick={() => void toggleActive(t.id, !t.is_active)}
                      >
                        {t.is_active ? "SUSPEND" : "RESTORE"}
                      </button>
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
