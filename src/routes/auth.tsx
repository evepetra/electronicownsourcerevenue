import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCouncils } from "@/lib/council";
import { ROLES, type Role } from "@/lib/eosr";
import { buttonClass, Field, inputClass } from "@/components/eosr/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — e-OSR Revenue Collection" },
      {
        name: "description",
        content:
          "Secure sign in for council revenue officers, cashiers, auditors and administrators of the e-OSR own source revenue system.",
      },
      { property: "og:title", content: "Staff Sign In — e-OSR Revenue Collection" },
      {
        property: "og:description",
        content: "Secure staff access to Uganda local government own source revenue collection.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, refresh } = useAuth();
  const { data: councils } = useCouncils();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [staffId, setStaffId] = useState("");
  const [councilId, setCouncilId] = useState("");
  const [role, setRole] = useState<Role>("REVENUE_OFFICER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  useEffect(() => {
    if (!councilId && councils?.length) setCouncilId(councils[0]?.id ?? "");
  }, [councils, councilId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        await refresh();
        await navigate({ to: "/" });
        return;
      }

      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (err) throw err;

      if (!data.session) {
        setNotice("Account created. Confirm your email, then sign in.");
        setMode("signin");
        return;
      }

      const uid = data.session.user.id;
      await supabase.from("profiles").upsert({
        id: uid,
        email,
        full_name: fullName || email.split("@")[0] || "Staff Member",
        staff_id: staffId || `OSR-${uid.slice(0, 6).toUpperCase()}`,
        council_id: councilId || null,
      });
      await supabase.rpc("claim_role", { _role: role });
      await supabase.from("audit_logs").insert({
        actor: email,
        action: "STAFF_REGISTERED",
        entity: "profiles",
        entity_id: uid,
        details: `Requested role ${role}`,
      });
      await refresh();
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between border-r border-line bg-panel p-10 lg:flex">
        <div>
          <div className="num text-[10px] tracking-[0.3em] text-civic">U G A N D A</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">e-OSR</h1>
          <p className="num mt-1 text-[11px] tracking-wider text-muted-foreground">
            OWN SOURCE REVENUE · LOCAL GOVERNMENT COLLECTION PLATFORM
          </p>
        </div>

        <div className="space-y-3">
          {[
            ["01", "Digitised taxpayer register & premise assessment"],
            ["02", "Mobile money, USSD and cashier collection channels"],
            ["03", "QR-verifiable receipts and bank reconciliation"],
            ["04", "Immutable audit trail across every council"],
          ].map(([no, text]) => (
            <div key={no} className="flex items-start gap-3 rounded-md border border-line bg-panel2 p-3">
              <span className="num text-[11px] text-civic">{no}</span>
              <span className="text-[13px] text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>

        <div className="num text-[10px] tracking-wider text-muted-foreground">
          MUKONO · JINJA · ENTEBBE — MULTI-COUNCIL DEPLOYMENT
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {mode === "signin" ? "Staff sign in" : "Register staff account"}
            </h2>
            <p className="num mt-1 text-[11px] text-muted-foreground">
              {mode === "signin"
                ? "AUTHORISED COUNCIL PERSONNEL ONLY"
                : "FIRST ACCOUNT BECOMES SYSTEM ADMINISTRATOR"}
            </p>
          </div>

          <div className="flex gap-1 rounded-sm border border-line bg-panel2 p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "num flex-1 rounded-sm px-2 py-1.5 text-[10px] tracking-wider transition-colors",
                  mode === m ? "bg-civic/15 text-civic" : "text-muted-foreground",
                )}
              >
                {m === "signin" ? "SIGN IN" : "REGISTER"}
              </button>
            ))}
          </div>

          <Field label="Work email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="officer@mukono.go.ug"
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </Field>

          {mode === "signup" && (
            <>
              <Field label="Full name">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  placeholder="Sarah Nabirye"
                />
              </Field>
              <Field label="Staff ID">
                <input
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className={inputClass}
                  placeholder="MKO-2026-014"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Council">
                  <select
                    value={councilId}
                    onChange={(e) => setCouncilId(e.target.value)}
                    className={inputClass}
                  >
                    {(councils ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Requested role">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className={inputClass}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          )}

          {error && (
            <p className="num rounded-sm border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p className="num rounded-sm border border-civic/30 bg-civic/10 px-2.5 py-2 text-[11px] text-civic">
              {notice}
            </p>
          )}

          <button type="submit" disabled={busy} className={cn(buttonClass, "w-full")}>
            {busy ? "WORKING…" : mode === "signin" ? "ENTER SYSTEM" : "CREATE ACCOUNT"}
          </button>
        </form>
      </div>
    </div>
  );
}
