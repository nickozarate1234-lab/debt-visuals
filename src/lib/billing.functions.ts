import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailOf = (claims: Record<string, unknown>) => (typeof claims["email"] === "string" ? claims["email"] : undefined);

/** Starts checkout: monthly = card subscription, annual = one-time payment (Yape or card). Returns the Mercado Pago URL. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan: z.enum(["mensual", "anual"]) }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const mp = await import("@/lib/mercadopago.server");
    const email = emailOf(context.claims as Record<string, unknown>);
    try {
      if (data.plan === "mensual") {
        if (!email) return { error: "Tu cuenta necesita un correo para la suscripción" };
        return { url: await mp.createSubscription({ userId: context.userId, email }) };
      }
      return { url: await mp.createPreference({ userId: context.userId, email, plan: "anual" }) };
    } catch (e) {
      console.error("startCheckout", e);
      return { error: "No pude abrir Mercado Pago. Intenta otra vez." };
    }
  });

/** When Mercado Pago sends the user back, confirm right away (the webhook does the same, this is just faster). */
export const confirmReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ paymentId: z.string().regex(/^\d{1,20}$/).optional(), preapprovalId: z.string().regex(/^[\w-]{4,64}$/).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ pro: boolean; status: string } | { error: string }> => {
    const mp = await import("@/lib/mercadopago.server");
    try {
      if (data.preapprovalId) {
        const r = await mp.syncSubscription(data.preapprovalId);
        if (!r.ok || r.userId !== context.userId) return { error: "Esa suscripción no corresponde a tu cuenta" };
        return { pro: !!r.paidUntil, status: r.status };
      }
      if (data.paymentId) {
        const r = await mp.syncPayment(data.paymentId);
        if (!r.ok || r.userId !== context.userId) return { error: "Ese pago no corresponde a tu cuenta" };
        return { pro: r.status === "approved", status: r.status };
      }
      return { error: "Falta el pago" };
    } catch (e) {
      console.error("confirmReturn", e);
      return { error: "Todavía no pude confirmar el pago. Si pagaste, se activará en unos minutos." };
    }
  });

/** Cancels the monthly subscription. Pro stays until the period already paid ends. */
export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().regex(/^[\w-]{4,64}$/) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const mp = await import("@/lib/mercadopago.server");
    try {
      await mp.cancelSubscription(data.id, context.userId);
      return { ok: true };
    } catch (e) {
      console.error("cancelMySubscription", e);
      return { error: "No pude cancelar. Intenta otra vez." };
    }
  });
