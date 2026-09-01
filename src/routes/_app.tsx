import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell, NAV } from "@/components/eosr/AppShell";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="num text-[11px] tracking-[0.3em] text-muted-foreground">
          e-OSR · AUTHENTICATING…
        </div>
      </div>
    );
  }

  const entry = NAV.find((i) => i.to === pathname);
  const denied = !!entry && !!role && !entry.roles.includes(role);

  return (
    <AppShell>
      {denied ? (
        <div className="rise rounded-md border border-line bg-panel p-10 text-center">
          <div className="num text-[10px] tracking-[0.25em] text-destructive">ACCESS DENIED</div>
          <p className="mt-3 text-sm text-muted-foreground">
            Your role ({role.replace(/_/g, " ")}) is not cleared for module {entry.no} —{" "}
            {entry.label}.
          </p>
        </div>
      ) : (
        <Outlet />
      )}
    </AppShell>
  );
}
