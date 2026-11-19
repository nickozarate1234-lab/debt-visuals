/** Free plan size and Pro options (Mercado Pago). Prices in soles. */
export const FREE_LIMIT = 200;

export const PLANS = {
  // Charged automatically every month with a card (Mercado Pago subscription). Cancel anytime.
  mensual: { id: "mensual", kind: "subscription", title: "Mis Finanzas Pro · mensual", price: 9.9, days: 30 },
  // One payment for a year (Yape or card).
  anual: { id: "anual", kind: "one_time", title: "Mis Finanzas Pro · 1 año", price: 79, days: 365 },
} as const;

export type PlanId = keyof typeof PLANS;
export const isPlanId = (v: unknown): v is PlanId => v === "mensual" || v === "anual";

/** Marketing numbers for the annual plan, derived from the prices so they never drift. */
export const ANUAL_PER_MONTH = Math.floor((PLANS.anual.price / 12) * 100) / 100; // S/ 6.58
export const ANUAL_SAVING = Math.round((PLANS.mensual.price * 12 - PLANS.anual.price) * 100) / 100; // S/ 39.80
export const ANUAL_SAVING_PCT = Math.round((1 - PLANS.anual.price / (PLANS.mensual.price * 12)) * 100); // 33%

export type MyPlan = {
  pro: boolean;
  lifetime: boolean;
  pro_until: string | null;
  used: number;
  limit: number;
  subscription: { id: string; status: string; paid_until: string | null } | null;
};

/** True when an insert failed because the free plan is full (raised by the database trigger). */
export const isLimitError = (e: { message?: string } | null | undefined) => !!e?.message?.includes("LIMITE_GRATIS");

/** Ask the app to show the plans sheet (listened to by <PlanSheet/>). */
export const openPaywall = () => window.dispatchEvent(new CustomEvent("open-paywall"));
