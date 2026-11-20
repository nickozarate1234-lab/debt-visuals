import { z } from "zod";

/** What the AI needs to know about each of the user's accounts. */
export type AccountRef = { id: string; name: string; kind: "debito" | "credito"; legacy?: string | null | undefined; currency?: "PEN" | "USD" | undefined };

export const accountRefsSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      name: z.string().min(1).max(60),
      kind: z.enum(["debito", "credito"]),
      legacy: z.string().max(10).nullish(),
      currency: z.enum(["PEN", "USD"]).optional(),
    }),
  )
  .min(1)
  .max(30);

/** Default accounts when the person doesn't name one: the original BCP / iO, else the first of each kind. */
export function accountDefaults(accounts: AccountRef[]) {
  const debit = accounts.find((a) => a.legacy === "bcp") ?? accounts.find((a) => a.kind === "debito");
  const credit = accounts.find((a) => a.legacy === "io") ?? accounts.find((a) => a.kind === "credito");
  return { debit: debit ?? credit ?? accounts[0]!, credit: credit ?? debit ?? accounts[0]! };
}

/** Instructions block describing the accounts and how to choose one. */
export function accountsGuide(accounts: AccountRef[], source: "voz" | "voucher") {
  const { debit, credit } = accountDefaults(accounts);
  const list = accounts.map((a) => `- "${a.id}": ${a.name} (${a.kind === "credito" ? "tarjeta de crédito" : "cuenta de débito / ahorros"}, en ${a.currency === "USD" ? "dólares" : "soles"})`).join("\n");
  const rule =
    source === "voz"
      ? `Si la persona nombra una cuenta o tarjeta (aunque lo diga distinto, ej. "la latam" = "LATAM Pass", "la de ahorros"), usa esa. Si no nombra ninguna: Yape, Plin, transferencia, efectivo o depósitos → "${debit.id}"; compras con tarjeta de crédito → "${credit.id}". Si no hay pistas, "${debit.id}".`
      : `Si el comprobante muestra el banco, la tarjeta o el nombre de la cuenta (ej. "LATAM Pass", "Interbank", últimos dígitos en el nombre), elige la que coincida. Si no: Yape, Plin, transferencia o app bancaria → "${debit.id}"; voucher de POS o boleta pagada con tarjeta → "${credit.id}". Si es dudoso, "${credit.id}".`;
  const usd = accounts.some((a) => a.currency === "USD") ? " Si el monto está en dólares y no nombra cuenta, prefiere una cuenta del mismo tipo en dólares." : "";
  return `cuenta: el id (entre comillas) de la cuenta usada, de esta lista:\n${list}\n${rule}${usd}\nmoneda: "USD" si el monto está en dólares ("dólares", "$", "US$", "USD"); si no, "PEN" (soles, "lucas", "S/").`;
}

/** Keeps the AI's choice only if it is one of the user's accounts; credit cards are always spending. */
export function resolveAccount<T extends { cuenta: string; movimiento: "egreso" | "ingreso" }>(m: T, accounts: AccountRef[], fallback: AccountRef): T {
  const acc = accounts.find((a) => a.id === m.cuenta) ?? fallback;
  return { ...m, cuenta: acc.id, movimiento: acc.kind === "credito" ? "egreso" : m.movimiento };
}
