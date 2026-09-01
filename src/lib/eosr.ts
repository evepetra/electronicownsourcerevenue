export const REVENUE_SOURCES = [
  "MARKET_DUE",
  "LICENCE_FEE",
  "PARK_FEE",
  "PROPERTY_RATE",
] as const;

export const CHANNELS = ["MOMO", "USSD", "CASHIER"] as const;

export const ROLES = [
  "ADMIN",
  "COUNCIL_ADMIN",
  "MAYOR",
  "REVENUE_OFFICER",
  "CASHIER",
  "AUDITOR",
] as const;
export type Role = (typeof ROLES)[number];

export function ugx(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-UG", { maximumFractionDigits: 0 });
}

export function compactUgx(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + "B";
  if (Math.abs(value) >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (Math.abs(value) >= 1_000) return Math.round(value / 1_000) + "K";
  return String(Math.round(value));
}

export function shortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

export function clockTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function monthKey(value: string | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("en-GB", { month: "short" })
    .toUpperCase();
}

export const channelTone: Record<string, string> = {
  MOMO: "text-civic ring-civic/25 bg-civic/10",
  USSD: "text-violet ring-violet/25 bg-violet/10",
  CASHIER: "text-sky ring-sky/25 bg-sky/10",
};

export const sourceTone: Record<string, string> = {
  MARKET_DUE: "bg-civic",
  LICENCE_FEE: "bg-violet",
  PROPERTY_RATE: "bg-sky",
  PARK_FEE: "bg-warn",
};

export const statusTone: Record<string, string> = {
  PAID: "text-civic ring-civic/25 bg-civic/10",
  COMPLETED: "text-civic ring-civic/25 bg-civic/10",
  MATCHED: "text-civic ring-civic/25 bg-civic/10",
  ACTIVE: "text-civic ring-civic/25 bg-civic/10",
  UNPAID: "text-warn ring-warn/25 bg-warn/10",
  PENDING: "text-warn ring-warn/25 bg-warn/10",
  MANUAL_MATCH: "text-sky ring-sky/25 bg-sky/10",
  OUTSTANDING: "text-warn ring-warn/25 bg-warn/10",
  OVERDUE: "text-destructive ring-destructive/25 bg-destructive/10",
  UNMATCHED: "text-destructive ring-destructive/25 bg-destructive/10",
  VOIDED: "text-destructive ring-destructive/25 bg-destructive/10",
  APPROVED: "text-civic ring-civic/25 bg-civic/10",
  SUBMITTED: "text-sky ring-sky/25 bg-sky/10",
  DRAFT: "text-muted-foreground ring-border bg-accent",
  RETURNED: "text-destructive ring-destructive/25 bg-destructive/10",
  WRITTEN_OFF: "text-muted-foreground ring-border bg-accent",
};

export function receiptSerial(seq: number): string {
  return `MK-041-${String(88000 + seq).padStart(5, "0")}`;
}

export function randomRef(prefix = "REF"): string {
  return `${prefix}${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
}
