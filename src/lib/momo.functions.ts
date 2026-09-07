import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MOMO_BASE = "https://sandbox.momodeveloper.mtn.com";

type Creds = { userId: string; apiKey: string; subscriptionKey: string };

let cachedCreds: Creds | null = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Provision (once per worker) a sandbox API user + key against the MTN portal. */
async function provision(subscriptionKey: string): Promise<Creds> {
  if (cachedCreds && cachedCreds.subscriptionKey === subscriptionKey) return cachedCreds;

  const userId = crypto.randomUUID();
  const createRes = await fetch(`${MOMO_BASE}/v1_0/apiuser`, {
    method: "POST",
    headers: {
      "X-Reference-Id": userId,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ providerCallbackHost: "eosr.lovable.app" }),
  });
  if (!createRes.ok && createRes.status !== 409) {
    throw new Error(`MTN apiuser failed (${createRes.status}): ${await createRes.text()}`);
  }

  const keyRes = await fetch(`${MOMO_BASE}/v1_0/apiuser/${userId}/apikey`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": subscriptionKey },
  });
  if (!keyRes.ok) throw new Error(`MTN apikey failed (${keyRes.status}): ${await keyRes.text()}`);
  const { apiKey } = (await keyRes.json()) as { apiKey: string };

  cachedCreds = { userId, apiKey, subscriptionKey };
  cachedToken = null;
  return cachedCreds;
}

async function getToken(subscriptionKey: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;
  const creds = await provision(subscriptionKey);
  const basic = btoa(`${creds.userId}:${creds.apiKey}`);
  const res = await fetch(`${MOMO_BASE}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });
  if (!res.ok) throw new Error(`MTN token failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

function normaliseMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("256")) return digits;
  if (digits.startsWith("0")) return `256${digits.slice(1)}`;
  return digits;
}

/** Ask the payer's handset to approve a collection. */
export const requestMomoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        invoiceNo: z.string().min(1).max(64),
        msisdn: z.string().min(9).max(20),
        amount: z.number().positive().max(1_000_000_000),
        payerMessage: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const subscriptionKey = process.env["MTN_MOMO_SUBSCRIPTION_KEY"];
    const msisdn = normaliseMsisdn(data.msisdn);
    const referenceId = crypto.randomUUID();
    const externalId = `EOSR-${Date.now().toString().slice(-9)}`;
    const mode = subscriptionKey ? "SANDBOX" : "SIMULATOR";

    let status = "PENDING";
    let reason: string | null = null;

    if (subscriptionKey) {
      try {
        const token = await getToken(subscriptionKey);
        const res = await fetch(`${MOMO_BASE}/collection/v1_0/requesttopay`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Reference-Id": referenceId,
            "X-Target-Environment": "sandbox",
            "Ocp-Apim-Subscription-Key": subscriptionKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: String(Math.round(data.amount)),
            currency: "EUR",
            externalId,
            payer: { partyIdType: "MSISDN", partyId: msisdn },
            payerMessage: data.payerMessage ?? `Council dues ${data.invoiceNo}`,
            payeeNote: `e-OSR ${data.invoiceNo}`,
          }),
        });
        if (res.status !== 202) {
          status = "FAILED";
          reason = `MTN rejected the request (${res.status}): ${(await res.text()).slice(0, 200)}`;
        }
      } catch (err) {
        status = "FAILED";
        reason = err instanceof Error ? err.message : "MTN sandbox unreachable";
      }
    }

    const { data: row, error } = await context.supabase
      .from("momo_transactions")
      .insert({
        invoice_no: data.invoiceNo,
        msisdn,
        amount: data.amount,
        currency: subscriptionKey ? "EUR" : "UGX",
        external_id: externalId,
        reference_id: referenceId,
        provider: "MTN",
        mode,
        status,
        reason,
      })
      .select()
      .single();
    if (error) return { ok: false as const, error: error.message, transaction: null };

    return { ok: status !== "FAILED", error: reason, transaction: row };
  });

/** Poll MTN (or the simulator) for the outcome of a collection request. */
export const checkMomoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("momo_transactions")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !row) return { ok: false as const, error: error?.message ?? "Not found", status: "UNKNOWN" };
    if (row.status !== "PENDING")
      return { ok: true as const, error: null, status: row.status as string, financialTransactionId: row.financial_transaction_id };

    let status = "PENDING";
    let financialTransactionId: string | null = null;
    let reason: string | null = null;

    if (row.mode === "SIMULATOR") {
      // Handsets in the simulator approve after a few seconds; numbers ending in 0 decline.
      const elapsed = Date.now() - new Date(row.created_at).getTime();
      if (elapsed > 5000) {
        const declined = row.msisdn.endsWith("0");
        status = declined ? "FAILED" : "SUCCESSFUL";
        reason = declined ? "Payer declined the prompt" : null;
        financialTransactionId = declined ? null : `SIM${Date.now().toString().slice(-10)}`;
      }
    } else {
      const subscriptionKey = process.env["MTN_MOMO_SUBSCRIPTION_KEY"];
      if (!subscriptionKey) return { ok: false as const, error: "MoMo key missing", status: "PENDING" };
      try {
        const token = await getToken(subscriptionKey);
        const res = await fetch(`${MOMO_BASE}/collection/v1_0/requesttopay/${row.reference_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Target-Environment": "sandbox",
            "Ocp-Apim-Subscription-Key": subscriptionKey,
          },
        });
        if (res.ok) {
          const json = (await res.json()) as {
            status: string;
            financialTransactionId?: string;
            reason?: string | { message?: string };
          };
          status = json.status ?? "PENDING";
          financialTransactionId = json.financialTransactionId ?? null;
          reason =
            typeof json.reason === "string" ? json.reason : (json.reason?.message ?? null);
        } else {
          reason = `Status check failed (${res.status})`;
        }
      } catch (err) {
        reason = err instanceof Error ? err.message : "MTN sandbox unreachable";
      }
    }

    if (status !== row.status) {
      await context.supabase
        .from("momo_transactions")
        .update({ status, financial_transaction_id: financialTransactionId, reason })
        .eq("id", row.id);
    }

    return { ok: true as const, error: reason, status, financialTransactionId };
  });

/** Link a completed collection to the payment record it settled. */
export const linkMomoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), paymentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("momo_transactions")
      .update({ payment_id: data.paymentId })
      .eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });
