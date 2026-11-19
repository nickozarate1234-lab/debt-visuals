// Server-only Mercado Pago helpers. Load inside server handlers with a dynamic import.
import { createHmac, timingSafeEqual } from "node:crypto";
import { isPlanId, PLANS, type PlanId } from "@/lib/plans";

const API = "https://api.mercadopago.com";

function token() {
  const t = process.env["MP_ACCESS_TOKEN"];
  if (!t) throw new Error("Falta MP_ACCESS_TOKEN en las variables de entorno del servidor");
  return t;
}
export const appUrl = () => (process.env["APP_URL"] || "https://misfinanzasperu.nickozarate1234.workers.dev").replace(/\/$/, "");

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body as T;
}

/** Hosted checkout for the one-time annual pass (Yape, cards, saved cards). Returns the URL to send the user to. */
export async function createPreference(opts: { userId: string; email?: string | undefined; plan: PlanId }) {
  const p = PLANS[opts.plan];
  const base = appUrl();
  const pref = await mp<{ id: string; init_point: string; sandbox_init_point?: string }>("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      items: [{ id: `pro-${p.id}`, title: p.title, quantity: 1, currency_id: "PEN", unit_price: p.price }],
      ...(opts.email ? { payer: { email: opts.email } } : {}),
      external_reference: `${opts.userId}|${p.id}`,
      metadata: { user_id: opts.userId, plan: p.id },
      notification_url: `${base}/api/public/mp-webhook`,
      back_urls: { success: `${base}/?pago=ok`, pending: `${base}/?pago=pendiente`, failure: `${base}/?pago=error` },
      auto_return: "approved",
      statement_descriptor: "MISFINANZAS",
    }),
  });
  const sandbox = token().startsWith("TEST-");
  return (sandbox && pref.sandbox_init_point) || pref.init_point;
}

type MpPayment = { id: number; status: string; transaction_amount: number; currency_id: string; external_reference?: string | null };

/**
 * Reads the payment from Mercado Pago (never trusting the caller), checks it matches a plan,
 * and records it. Pro is extended only once, when approved. Returns the user and whether Pro was applied now.
 */
export async function syncPayment(paymentId: string) {
  const pay = await mp<MpPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`);
  const [userId, plan] = (pay.external_reference ?? "").split("|");
  if (!userId || !isPlanId(plan)) return { ok: false as const, reason: "referencia desconocida" };
  const p = PLANS[plan];
  const amountOk = pay.currency_id === "PEN" && Math.abs(Number(pay.transaction_amount) - p.price) < 0.01;
  const status = amountOk ? pay.status : `rechazado_monto:${pay.status}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("apply_payment", {
    p_provider_payment_id: String(pay.id),
    p_user: userId,
    p_plan: plan,
    p_amount: Number(pay.transaction_amount),
    p_currency: pay.currency_id,
    p_status: status,
    p_days: p.days,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const, userId, plan, status: pay.status, applied: !!data };
}

/**
 * Webhook signature check (x-signature: "ts=…,v1=…"), signed with the secret from
 * Mercado Pago → Tus integraciones → Webhooks. Manifest: id:{data.id};request-id:{x-request-id};ts:{ts};
 */
export function validSignature(headers: Headers, dataId: string) {
  const secret = process.env["MP_WEBHOOK_SECRET"];
  if (!secret) return false;
  const parts = Object.fromEntries((headers.get("x-signature") ?? "").split(",").map((kv) => kv.trim().split("=") as [string, string]));
  const ts = parts["ts"], v1 = parts["v1"];
  if (!ts || !v1) return false;
  const requestId = headers.get("x-request-id");
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

// ---------- Monthly subscription (preapproval) ----------

type MpPreapproval = {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  external_reference?: string | null;
  auto_recurring?: { transaction_amount?: number; currency_id?: string };
  summarized?: { charged_quantity?: number | null; last_charged_date?: string | null };
};

/** Starts the monthly subscription: the user enters a card once and is charged automatically each month. */
export async function createSubscription(opts: { userId: string; email: string }) {
  const p = PLANS.mensual;
  const sub = await mp<{ id: string; init_point: string; sandbox_init_point?: string }>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: p.title,
      external_reference: `${opts.userId}|${p.id}`,
      payer_email: opts.email,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: p.price, currency_id: "PEN" },
      back_url: `${appUrl()}/?suscripcion=ok`,
      status: "pending",
    }),
  });
  return (token().startsWith("TEST-") && sub.sandbox_init_point) || sub.init_point;
}

const DAY = 86_400_000;
/** Paid until one month after the last successful charge, plus 3 days of grace for retries. */
function paidUntil(lastCharge: string) {
  const d = new Date(lastCharge);
  d.setMonth(d.getMonth() + 1);
  return new Date(d.getTime() + 3 * DAY).toISOString();
}

/** Re-reads the subscription from Mercado Pago and updates the user's Pro period. */
export async function syncSubscription(preapprovalId: string) {
  const sub = await mp<MpPreapproval>(`/preapproval/${encodeURIComponent(preapprovalId)}`);
  const [userId, plan] = (sub.external_reference ?? "").split("|");
  if (!userId || plan !== "mensual") return { ok: false as const, reason: "referencia desconocida" };
  const amountOk = sub.auto_recurring?.currency_id === "PEN" && Math.abs(Number(sub.auto_recurring?.transaction_amount) - PLANS.mensual.price) < 0.01;
  const charged = (sub.summarized?.charged_quantity ?? 0) > 0 && !!sub.summarized?.last_charged_date;
  const until = amountOk && charged ? paidUntil(sub.summarized!.last_charged_date!) : null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("apply_subscription", { p_subscription_id: sub.id, p_user: userId, p_status: sub.status, p_paid_until: until });
  if (error) throw new Error(error.message);
  return { ok: true as const, userId, status: sub.status, paidUntil: until };
}

/** A monthly charge notification points to its subscription. */
export async function syncAuthorizedPayment(id: string) {
  const ap = await mp<{ preapproval_id?: string }>(`/authorized_payments/${encodeURIComponent(id)}`);
  return ap.preapproval_id ? syncSubscription(ap.preapproval_id) : { ok: false as const, reason: "sin suscripción" };
}

/** Cancels future charges. Pro stays active until the period already paid ends. */
export async function cancelSubscription(preapprovalId: string, userId: string) {
  const sub = await mp<MpPreapproval>(`/preapproval/${encodeURIComponent(preapprovalId)}`);
  if (!(sub.external_reference ?? "").startsWith(`${userId}|`)) throw new Error("Esa suscripción no es tuya");
  await mp(`/preapproval/${encodeURIComponent(preapprovalId)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  return syncSubscription(preapprovalId);
}
