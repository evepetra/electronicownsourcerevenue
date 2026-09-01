import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { statusTone, ugx } from "@/lib/eosr";

export function Panel({
  title,
  meta,
  right,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rise rounded-md border border-line bg-panel", className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 pt-4 pb-3">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[13px] font-medium tracking-tight">{title}</h2>
            )}
            {meta && <div className="label-mono mt-0.5">{meta}</div>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  unit = "UGX",
  note,
  delta,
  tone = "civic",
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  delta?: string;
  tone?: "civic" | "warn" | "destructive";
}) {
  const toneClass =
    tone === "warn"
      ? "text-warn bg-warn/10 ring-warn/25"
      : tone === "destructive"
        ? "text-destructive bg-destructive/10 ring-destructive/25"
        : "text-civic bg-civic/10 ring-civic/25";
  return (
    <div className="rise rounded-md border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="label-mono truncate">{label}</span>
        <span className="num text-[9px] text-muted-foreground">{unit}</span>
      </div>
      <div
        className={cn(
          "num mt-3 text-2xl leading-none font-semibold",
          tone === "warn" ? "text-warn" : tone === "destructive" ? "text-destructive" : "",
        )}
      >
        {value}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {delta && (
          <span
            className={cn("num rounded-sm px-1.5 py-0.5 text-[10px] font-medium ring-1", toneClass)}
          >
            {delta}
          </span>
        )}
        {note && <span className="num text-[10px] text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

export function Pill({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "num inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] ring-1",
        statusTone[value] ?? "bg-accent text-muted-foreground ring-border",
        className,
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

export function Meter({
  label,
  amount,
  pct,
  color,
  suffix,
}: {
  label: string;
  amount?: number;
  pct: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="num text-[11px] tracking-wider">{label.replace(/_/g, " ")}</span>
        <span className="num text-[11px] text-muted-foreground">
          {amount !== undefined ? `${ugx(amount)} · ` : ""}
          {pct.toFixed(1)}%{suffix ? ` · ${suffix}` : ""}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border/50">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, Math.max(1.5, pct))}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyRow({ children = "No records" }: { children?: ReactNode }) {
  return (
    <div className="num px-4 py-10 text-center text-[11px] text-muted-foreground">{children}</div>
  );
}

export function LoadingRow() {
  return (
    <div className="num px-4 py-10 text-center text-[11px] text-muted-foreground">
      LOADING LEDGER…
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string | undefined;
}) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="num mt-1 block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "num h-9 w-full rounded-sm border border-line bg-panel2 px-2.5 text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-civic/60";

export const buttonClass =
  "num inline-flex h-9 items-center justify-center gap-2 rounded-sm bg-civic px-3.5 text-[11px] font-semibold tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

export const ghostButtonClass =
  "num inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-line bg-panel2 px-3 text-[11px] tracking-wider text-foreground transition-colors hover:bg-accent disabled:opacity-50";
