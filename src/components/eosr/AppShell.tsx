import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCouncil } from "@/lib/council";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/eosr";

type NavItem = { no: string; label: string; to: string; roles: Role[] };

const ALL: Role[] = ["ADMIN", "COUNCIL_ADMIN", "MAYOR", "REVENUE_OFFICER", "CASHIER", "AUDITOR"];

export const NAV: NavItem[] = [
  { no: "01", label: "Dashboard", to: "/", roles: ALL },
  {
    no: "02",
    label: "Taxpayer Register",
    to: "/taxpayers",
    roles: ["ADMIN", "COUNCIL_ADMIN", "MAYOR", "REVENUE_OFFICER", "AUDITOR"],
  },
  {
    no: "03",
    label: "Billing & Invoices",
    to: "/billing",
    roles: ["ADMIN", "COUNCIL_ADMIN", "MAYOR", "REVENUE_OFFICER", "AUDITOR"],
  },
  {
    no: "04",
    label: "Mobile-Money Payments",
    to: "/payments",
    roles: ["ADMIN", "COUNCIL_ADMIN", "REVENUE_OFFICER", "CASHIER"],
  },
  { no: "05", label: "Receipt Verification", to: "/receipts", roles: ALL },
  {
    no: "06",
    label: "Bank Reconciliation",
    to: "/reconciliation",
    roles: ["ADMIN", "COUNCIL_ADMIN", "MAYOR", "AUDITOR", "CASHIER"],
  },
  { no: "07", label: "Reports", to: "/reports", roles: ALL },
  { no: "08", label: "Audit Log", to: "/audit", roles: ["ADMIN", "COUNCIL_ADMIN", "MAYOR", "AUDITOR"] },
  {
    no: "09",
    label: "Arrears",
    to: "/arrears",
    roles: ["ADMIN", "COUNCIL_ADMIN", "MAYOR", "REVENUE_OFFICER", "AUDITOR"],
  },
  { no: "10", label: "Administration", to: "/admin", roles: ["ADMIN"] },
  { no: "11", label: "Council Profile", to: "/council", roles: ALL },
  { no: "12", label: "Council Dashboard", to: "/council-dashboard", roles: ALL },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, signOut, user } = useAuth();
  const { councils, council, setCouncilId } = useCouncil();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [now, setNow] = useState<string>("");
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date()
          .toLocaleString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          .toUpperCase()
          .replace(",", " ·"),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const items = NAV.filter((i) => !role || i.roles.includes(role));
  const active = items.find((i) => i.to === pathname) ?? items[0];
  const name = profile?.full_name || user?.email || "Staff";

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-panel md:flex">
        <div className="border-b border-line px-5 pt-5 pb-4">
          <div className="num text-[10px] tracking-[0.25em] text-civic">U G A N D A</div>
          <div className="mt-1 text-lg leading-none font-semibold tracking-tight">e-OSR</div>
          <div className="num mt-1 text-[10px] text-muted-foreground">OWN SOURCE REVENUE</div>
        </div>

        <div className="px-3 pt-4">
          <div className="rounded-md border border-line bg-panel2 p-2.5">
            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 text-left"
            >
              <span className="grid size-8 place-items-center rounded-sm bg-civic/15 text-civic ring-1 ring-civic/30">
                <span className="num text-[11px] font-semibold">{council?.code ?? "··"}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-tight font-medium">
                  {council?.name ?? "Select council"}
                </span>
                <span className="num block text-[9px] tracking-wider text-muted-foreground">
                  {council ? `${council.district.toUpperCase()} DISTRICT` : "COUNCIL"}
                </span>
              </span>
              <span className="num text-[9px] text-muted-foreground">▾</span>
            </button>

            {switcherOpen && (
              <div className="mt-2 space-y-0.5 border-t border-line pt-2">
                {councils.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCouncilId(c.id);
                      setSwitcherOpen(false);
                    }}
                    className={cn(
                      "num block w-full rounded-sm px-2 py-1.5 text-left text-[11px] transition-colors",
                      c.id === council?.id
                        ? "bg-civic/10 text-civic"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {c.code} · {c.name}
                  </button>
                ))}
              </div>
            )}

            <Link
              to="/council"
              onClick={() => setSwitcherOpen(false)}
              className="num mt-2 block rounded-sm border border-line px-2 py-1.5 text-center text-[9px] tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              VIEW COUNCIL PROFILE →
            </Link>

            <div className="mt-2 flex items-center justify-between">
              <span className="num rounded-sm bg-civic/10 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-civic ring-1 ring-civic/25">
                {(role ?? "STAFF").replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <div className="flex items-center justify-between px-2.5 pb-2">
            <span className="num text-[9px] tracking-[0.2em] text-muted-foreground">MODULES</span>
            <span className="num text-[9px] text-muted-foreground">{items.length}</span>
          </div>
          {items.map((item) => {
            const isActive = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                  isActive
                    ? "bg-civic/10 font-medium text-foreground ring-1 ring-civic/25"
                    : "text-muted-foreground hover:bg-panel2 hover:text-foreground",
                )}
              >
                <span
                  className={cn("num text-[13px]", isActive ? "text-civic" : "text-muted-foreground/70")}
                >
                  {item.no}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-sm bg-panel2 ring-1 ring-line">
              <span className="num text-[10px] font-semibold">{initials(name)}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] leading-tight font-medium">{name}</span>
              <span className="num block text-[9px] text-muted-foreground">
                ID {profile?.staff_id ?? "—"}
              </span>
            </span>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                await navigate({ to: "/auth" });
              }}
              className="num rounded-sm border border-line px-1.5 py-1 text-[9px] text-muted-foreground transition-colors hover:text-foreground"
            >
              EXIT
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="num truncate text-[10px] tracking-[0.2em] text-muted-foreground">
              MODULE {active?.no ?? "01"} / {(active?.label ?? "DASHBOARD").toUpperCase()}
            </span>
            <span className="num hidden text-[11px] lg:inline">{now}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              title="Toggle light / dark theme"
              className="num flex items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1.5 text-[10px] tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              {theme === "dark" ? "LIGHT" : "DARK"}
            </button>
            <span className="flex items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1.5">
              <span className="size-1.5 rounded-full bg-civic" />
              <span className="num text-[10px] tracking-wider text-muted-foreground">FEED · LIVE</span>
            </span>
            <span className="num hidden items-center gap-2 text-[11px] text-muted-foreground xl:flex">
              {councils.map((c, i) => (
                <span key={c.id} className="flex items-center gap-2">
                  {i > 0 && <span className="text-border">|</span>}
                  <button
                    type="button"
                    onClick={() => setCouncilId(c.id)}
                    className={cn(
                      "transition-colors hover:text-foreground",
                      c.id === council?.id && "text-foreground",
                    )}
                  >
                    {c.code}
                  </button>
                </span>
              ))}
            </span>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-line bg-panel px-3 py-2 md:hidden">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "num shrink-0 rounded-sm px-2 py-1 text-[10px] tracking-wider",
                pathname === item.to
                  ? "bg-civic/10 text-civic ring-1 ring-civic/25"
                  : "text-muted-foreground",
              )}
            >
              {item.no} {item.label.split(" ")[0]?.toUpperCase()}
            </Link>
          ))}
        </nav>

        <div className="flex-1 overflow-auto">
          <div className="space-y-4 px-4 py-5 md:px-6 md:py-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
