import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normaliseMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("256")) return `+${digits}`;
  if (digits.startsWith("0")) return `+256${digits.slice(1)}`;
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}

const messageSchema = z.object({
  msisdn: z.string().min(9).max(20),
  body: z.string().min(1).max(480),
  purpose: z.enum(["RECEIPT", "REMINDER", "NOTICE"]).default("RECEIPT"),
  invoiceNo: z.string().max(64).nullable().optional(),
});

async function deliver(messages: { msisdn: string; body: string }[]) {
  const username = process.env["AT_USERNAME"];
  const apiKey = process.env["AT_API_KEY"];
  if (!username || !apiKey) {
    return messages.map(() => ({
      status: "SIMULATED" as const,
      providerRef: `SIM-${crypto.randomUUID().slice(0, 8)}`,
      error: null as string | null,
      mode: "SIMULATOR" as const,
    }));
  }

  const endpoint =
    username === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

  const results: {
    status: "SENT" | "FAILED";
    providerRef: string | null;
    error: string | null;
    mode: "SANDBOX" | "LIVE";
  }[] = [];
  const mode = username === "sandbox" ? ("SANDBOX" as const) : ("LIVE" as const);

  for (const m of messages) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ username, to: m.msisdn, message: m.body }).toString(),
      });
      const text = await res.text();
      if (!res.ok) {
        results.push({ status: "FAILED", providerRef: null, error: text.slice(0, 200), mode });
        continue;
      }
      const json = JSON.parse(text) as {
        SMSMessageData?: { Recipients?: { status?: string; messageId?: string }[] };
      };
      const recipient = json.SMSMessageData?.Recipients?.[0];
      const ok = recipient?.status === "Success";
      results.push({
        status: ok ? "SENT" : "FAILED",
        providerRef: recipient?.messageId ?? null,
        error: ok ? null : (recipient?.status ?? "Provider rejected the message"),
        mode,
      });
    } catch (err) {
      results.push({
        status: "FAILED",
        providerRef: null,
        error: err instanceof Error ? err.message : "SMS gateway unreachable",
        mode,
      });
    }
  }
  return results;
}

export const sendSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => messageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const msisdn = normaliseMsisdn(data.msisdn);
    const [result] = await deliver([{ msisdn, body: data.body }]);
    const { error } = await context.supabase.from("sms_messages").insert({
      msisdn,
      body: data.body,
      purpose: data.purpose,
      invoice_no: data.invoiceNo ?? null,
      provider: "AFRICASTALKING",
      mode: result!.mode,
      status: result!.status,
      provider_ref: result!.providerRef,
      error: result!.error,
    });
    return { ok: result!.status !== "FAILED", status: result!.status, error: result!.error ?? error?.message ?? null };
  });

export const sendBulkSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ messages: z.array(messageSchema).min(1).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const prepared = data.messages.map((m) => ({ ...m, msisdn: normaliseMsisdn(m.msisdn) }));
    const results = await deliver(prepared.map((m) => ({ msisdn: m.msisdn, body: m.body })));
    const rows = prepared.map((m, i) => ({
      msisdn: m.msisdn,
      body: m.body,
      purpose: m.purpose,
      invoice_no: m.invoiceNo ?? null,
      provider: "AFRICASTALKING",
      mode: results[i]!.mode,
      status: results[i]!.status,
      provider_ref: results[i]!.providerRef,
      error: results[i]!.error,
    }));
    const { error } = await context.supabase.from("sms_messages").insert(rows);
    const sent = results.filter((r) => r.status !== "FAILED").length;
    return { ok: !error, sent, failed: results.length - sent, error: error?.message ?? null };
  });
