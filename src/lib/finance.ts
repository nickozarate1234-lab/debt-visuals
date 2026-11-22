/** Currencies the app supports (soles and dollars for now). */
export type Cur = "PEN" | "USD";
export const CURRENCIES: Cur[] = ["PEN", "USD"];
export const CUR_LABEL: Record<Cur, string> = { PEN: "Soles", USD: "Dólares" };
export const CUR_SYMBOL: Record<Cur, string> = { PEN: "S/", USD: "US$" };
export const asCur = (v: unknown): Cur => (v === "USD" ? "USD" : "PEN");

export type Profile = {
  user_id: string;
  /** Main currency: totals, projection and the traffic light are shown in it. */
  currency?: Cur;
  /** False until a new user picks the main currency in the welcome step. */
  currency_set?: boolean;
  /** Own exchange rate (soles per dollar); null/undefined = today's automatic rate. */
  usd_rate?: number | null;
  mesada1_currency?: Cur;
  mesada2_currency?: Cur;
  shortcut_token: string;
  mesada1_day: number;
  mesada1_amount: number;
  mesada2_day: number;
  mesada2_amount: number;
  io_cut_day: number;
  io_pay_day: number;
  yape_day: number;
  yape_amount: number;
  bbva_date: string | null;
  bbva_amount: number;
  projection_months: number;
};
export type BcpMovement = {
  id: string;
  seq: number;
  date: string | null;
  concept: string;
  amount: number;
  account_id?: string | null;
  transfer_id?: string | null;
  paid_card_id?: string | null;
  /** Card payment from an account in another currency: amount credited to the card, in the card's currency. */
  card_amount?: number | null;
};
export type IoExpense = { id: string; date: string; description: string; category: string; amount: number; account_id?: string | null };
export type Account = { id: string; name: string; kind: "debito" | "credito"; legacy: string | null; cut_day: number; pay_day: number; archived: boolean; credit_limit?: number | null; currency?: Cur };
export type Debt = {
  id: string;
  name: string;
  monthly_amount: number;
  pay_day: number;
  start_date: string;
  num_payments: number | null;
  pay_account_id: string | null;
};
export type Installment = {
  id: string;
  concept: string;
  original_amount: number;
  num_installments: number;
  monthly_amount: number;
  first_date: string;
  account_id?: string | null;
  /** When the purchase was made (set when a card expense is converted to cuotas). */
  purchase_date?: string | null;
};

export const IO_CATEGORIES = ["Comida", "Transporte", "Suscripciones", "Entretenimiento", "Salud", "Otros"];

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => {
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const todayStr = () => ymd(new Date());
/** Same day N months later, clamped to month end (Excel EDATE). */
export const addMonths = (s: string, n: number) => {
  const d = parse(s);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return ymd(target);
};
const dayOf = (y: number, m: number, day: number) => {
  const last = new Date(y, m + 1, 0).getDate();
  return ymd(new Date(y, m, Math.min(day, last)));
};

export const money = (n: number, sign = false, cur: Cur = "PEN") => {
  const s = `${CUR_SYMBOL[cur]} ${Math.abs(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (!sign) return n < 0 ? `−${s}` : s;
  return n < 0 ? `−${s}` : `+${s}`;
};
export const fmtDate = (s: string | null) => {
  if (!s) return "sin fecha";
  const d = parse(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** iO pay date: purchases up to the cut day are paid next month, after it the month after. */
export const ioPayDate = (date: string, p: Pick<Profile, "io_cut_day" | "io_pay_day">) => {
  const d = parse(date);
  const months = d.getDate() <= p.io_cut_day ? 1 : 2;
  return dayOf(d.getFullYear(), d.getMonth() + months, p.io_pay_day);
};

/** The card's pay date on or after `date` (a card that pays on day `payDay` of each month). */
export const nextPayDate = (date: string, payDay: number) => {
  const d = parse(date);
  const same = dayOf(d.getFullYear(), d.getMonth(), payDay);
  return same >= date ? same : dayOf(d.getFullYear(), d.getMonth() + 1, payDay);
};

/**
 * Pay dates on which each monthly installment is charged. `first_date` is when the first
 * cuota is due; any day works: it is billed on the card's next pay date, then monthly.
 * Without `payDay` the schedule follows `first_date` month by month.
 */
export const installmentDueDates = (i: Installment, payDay?: number) => {
  const n = Math.max(0, Math.floor(Number(i.num_installments) || 0));
  if (payDay == null) return Array.from({ length: n }, (_, k) => addMonths(i.first_date, k));
  const first = parse(nextPayDate(i.first_date, payDay));
  return Array.from({ length: n }, (_, k) => dayOf(first.getFullYear(), first.getMonth() + k, payDay));
};
export const installmentLast = (i: Installment, payDay?: number) => installmentDueDates(i, payDay).at(-1) ?? i.first_date;
export const installmentActive = (i: Installment, today = todayStr(), payDay?: number) => today <= installmentLast(i, payDay);

/**
 * Effective interest of a cuotas plan (French system, as Peruvian banks quote it):
 * the monthly rate TEM that makes n payments of `monthly` worth `original` today, and TEA = (1+TEM)^12 − 1.
 * Returns zeros when there is no interest, null when the numbers don't make sense.
 */
export function cuotaRate(original: number, monthly: number, n: number) {
  if (!(original > 0) || !(monthly > 0) || !(n >= 1)) return null;
  const total = monthly * n;
  if (total <= original + 0.005) return { tem: 0, tea: 0, total, interest: Math.max(0, total - original) };
  const pv = (i: number) => (monthly * (1 - Math.pow(1 + i, -n))) / i;
  let lo = 1e-9, hi = 1;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > original) lo = mid;
    else hi = mid;
  }
  const tem = (lo + hi) / 2;
  return { tem, tea: Math.pow(1 + tem, 12) - 1, total, interest: total - original };
}

/** Where a cuotas plan stands today: cuotas paid (pay date already passed), remaining, and principal still using the credit line. */
export function installmentStatus(i: Installment, payDay: number | undefined, today = todayStr()) {
  const due = installmentDueDates(i, payDay);
  const paid = due.filter((d) => d < today).length;
  const remaining = due.length - paid;
  const rate = cuotaRate(Number(i.original_amount), Number(i.monthly_amount), due.length);
  const m = Number(i.monthly_amount);
  // Each cuota paid frees its capital part of the line: what's left is the present value of the remaining cuotas.
  const principal =
    remaining === 0 ? 0 : rate && rate.tem > 0 ? (m * (1 - Math.pow(1 + rate.tem, -remaining))) / rate.tem : (Number(i.original_amount) * remaining) / Math.max(1, due.length);
  return { due, paid, remaining, next: due[paid] ?? null, remainingAmount: remaining * m, principal: Math.min(principal, Number(i.original_amount)), rate };
}

export const withBalances = <T extends BcpMovement>(rows: T[]) => {
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  let bal = 0;
  return sorted.map((r) => ({ ...r, balance: (bal += Number(r.amount)) }));
};
export const currentBalance = (rows: BcpMovement[]) => rows.reduce((s, r) => s + Number(r.amount), 0);

export const ioPaymentOn = (date: string, io: IoExpense[], cuotas: Installment[], p: Profile) => {
  const gastos = io.filter((e) => ioPayDate(e.date, p) === date).reduce((s, e) => s + Number(e.amount), 0);
  const cuo = cuotas
    .filter((c) => installmentDueDates(c, p.io_pay_day).includes(date))
    .reduce((s, c) => s + Number(c.monthly_amount), 0);
  return { gastos, cuotas: cuo, total: gastos + cuo };
};

/** Exchange context: the main currency and how many soles one dollar is worth. */
export type Fx = { main: Cur; rate: number };
export const DEFAULT_FX: Fx = { main: "PEN", rate: 1 };
/** Converts an amount from `from` to the main currency (or to `to`). */
export function conv(amount: number, from: Cur, fx: Fx, to: Cur = fx.main) {
  const n = Number(amount) || 0;
  if (from === to) return n;
  return from === "USD" ? n * fx.rate : n / fx.rate;
}
export const accCur = (accounts: Account[], id: string | null | undefined): Cur => asCur(accounts.find((a) => a.id === id)?.currency);
export const fxFromProfile = (p: Pick<Profile, "currency" | "usd_rate"> | null | undefined, autoRate: number): Fx => ({
  main: asCur(p?.currency),
  rate: p?.usd_rate && Number(p.usd_rate) > 0 ? Number(p.usd_rate) : autoRate,
});

/** Rows with no account belong to the original BCP (debit) / iO (credit) account. */
export const legacyId = (accounts: Account[], legacy: "bcp" | "io") => accounts.find((a) => a.legacy === legacy)?.id ?? null;
export const debitOf = (r: { account_id?: string | null }, accounts: Account[]) => r.account_id ?? legacyId(accounts, "bcp");
export const cardOf = (r: { account_id?: string | null }, accounts: Account[]) => r.account_id ?? legacyId(accounts, "io");
export const cycle = (a: Account) => ({ io_cut_day: a.cut_day, io_pay_day: a.pay_day });

/** Monthly dates a debt is due within [from, to]. */
export function debtDates(d: Debt, from: string, to: string) {
  const out: string[] = [];
  const s = parse(d.start_date);
  for (let k = 0; k < 600; k++) {
    if (d.num_payments != null && k >= d.num_payments) break;
    const date = dayOf(s.getFullYear(), s.getMonth() + k, d.pay_day);
    if (date < d.start_date) continue;
    if (date > to) break;
    if (date > from) out.push(date);
  }
  return out;
}
export const debtRemaining = (d: Debt, today = todayStr()) =>
  d.num_payments == null ? null : debtDates(d, "0000-00-00", addMonths(d.start_date, d.num_payments + 1)).filter((x) => x > today).length;

/** What a card will charge on payDate: its gastos + cuotas minus manual payments already made in that cycle. */
export function cardPaymentOn(card: Account, payDate: string, accounts: Account[], io: IoExpense[], cuotas: Installment[], bcp: BcpMovement[], today = todayStr()) {
  const mine = io.filter((e) => cardOf(e, accounts) === card.id);
  const myCuotas = cuotas.filter((c) => cardOf(c, accounts) === card.id);
  const base = ioPaymentOn(payDate, mine, myCuotas, cycle(card) as Profile);
  const prev = addMonths(payDate, -1);
  const paid = bcp
    .filter((r) => r.paid_card_id === card.id && (r.date ?? today) > prev && (r.date ?? today) <= payDate)
    .reduce((s, r) => s + (r.card_amount != null ? Number(r.card_amount) : -Number(r.amount)), 0);
  return { ...base, paid, due: Math.max(0, base.total - paid) };
}

/**
 * Credit line used on a card today: purchases not yet paid (statements due today or later, minus payments already
 * made toward them) plus the capital still owed on cuotas. Each cuota paid releases its capital part.
 */
export function cardCreditUsed(card: Account, accounts: Account[], io: IoExpense[], cuotas: Installment[], bcp: BcpMovement[], today = todayStr()) {
  const mine = io.filter((e) => cardOf(e, accounts) === card.id);
  const payDates = [...new Set(mine.map((e) => ioPayDate(e.date, cycle(card) as Profile)))].filter((d) => d >= today);
  const gastos = payDates.reduce((s, d) => {
    const p = cardPaymentOn(card, d, accounts, io, [], bcp, today);
    return s + Math.max(0, p.gastos - p.paid);
  }, 0);
  const plans = cuotas.filter((c) => cardOf(c, accounts) === card.id).map((c) => installmentStatus(c, card.pay_day, today));
  const enCuotas = plans.reduce((s, p) => s + p.principal, 0);
  const limit = card.credit_limit != null && Number(card.credit_limit) > 0 ? Number(card.credit_limit) : null;
  const used = gastos + enCuotas;
  return { limit, gastos, cuotas: enCuotas, used, available: limit == null ? null : limit - used };
}

/** A projected event: `amount`/`balance` in the main currency; `cur`/`original` keep the event's own currency. */
export type ProjEvent = { date: string; concept: string; amount: number; balance: number; cur: Cur; original: number };

export function project(
  p: Profile,
  bcp: BcpMovement[],
  io: IoExpense[],
  cuotas: Installment[],
  today = todayStr(),
  accounts: Account[] = [],
  debts: Debt[] = [],
  subs: Subscription[] = [],
  fx: Fx = DEFAULT_FX,
) {
  // Everything is projected in the main currency: each amount is converted from its own currency.
  const debitCur = (r: { account_id?: string | null }) => accCur(accounts, debitOf(r, accounts));
  const start = bcp.reduce((s, r) => s + conv(Number(r.amount), debitCur(r), fx), 0);
  const raw: Omit<ProjEvent, "balance">[] = [];
  const t = parse(today);
  const limit = addMonths(today, p.projection_months);
  const cards = accounts.filter((a) => a.kind === "credito" && !a.archived);
  for (let k = 0; k <= p.projection_months; k++) {
    const y = t.getFullYear();
    const m = t.getMonth() + k;
    raw.push({ date: dayOf(y, m, p.mesada1_day), concept: "Sueldo", amount: conv(Number(p.mesada1_amount), asCur(p.mesada1_currency), fx), cur: asCur(p.mesada1_currency), original: Number(p.mesada1_amount) });
    raw.push({ date: dayOf(y, m, p.mesada2_day), concept: "Sueldo", amount: conv(Number(p.mesada2_amount), asCur(p.mesada2_currency), fx), cur: asCur(p.mesada2_currency), original: Number(p.mesada2_amount) });
    for (const c of cards) {
      const payDate = dayOf(y, m, c.pay_day);
      const pay = cardPaymentOn(c, payDate, accounts, io, cuotas, bcp, today);
      if (pay.due !== 0) raw.push({ date: payDate, concept: `Pago ${c.name} (gastos + cuotas)`, amount: -conv(pay.due, asCur(c.currency), fx), cur: asCur(c.currency), original: -pay.due });
    }
  }
  for (const d of debts) {
    const cur = debitCur({ account_id: d.pay_account_id });
    for (const date of debtDates(d, today, limit)) raw.push({ date, concept: d.name, amount: -conv(Number(d.monthly_amount), cur, fx), cur, original: -Number(d.monthly_amount) });
  }

  for (const s of subs) {
    const acc = accounts.find((a) => a.id === s.pay_account_id);
    const cur = asCur(s.currency);
    if (acc?.kind === "credito") {
      // Paid with a card: each future charge (not registered yet) is paid on that card's pay date for the charge's cycle.
      if (acc.archived) continue;
      for (const charge of subDates(s, today, limit)) {
        raw.push({ date: ioPayDate(charge, cycle(acc)), concept: `Suscripción ${s.name} (${acc.name})`, amount: -conv(Number(s.amount), cur, fx), cur, original: -Number(s.amount) });
      }
      continue;
    }
    for (const date of subDates(s, today, limit)) raw.push({ date, concept: `Suscripción ${s.name}`, amount: -conv(Number(s.amount), cur, fx), cur, original: -Number(s.amount) });
  }
  const events = raw
    .filter((e) => e.date > today && e.date <= limit && e.amount !== 0)
    .sort((a, b) => (a.date === b.date ? b.amount - a.amount : a.date < b.date ? -1 : 1));
  let bal = start;
  const out: ProjEvent[] = events.map((e) => ({ ...e, balance: (bal += e.amount) }));

  const minOf = (list: ProjEvent[]) =>
    list.reduce<{ balance: number; date: string }>(
      (m, e) => (e.balance < m.balance ? { balance: e.balance, date: e.date } : m),
      { balance: start, date: today },
    );
  const in30 = addMonths(today, 1);
  return {
    start,
    events: out,
    min: minOf(out),
    min30: minOf(out.filter((e) => e.date <= in30)),
  };
}

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  cycle: "mensual" | "anual";
  charge_day: number;
  charge_month: number | null;
  category: string;
  pay_account_id: string | null;
  active: boolean;
  currency?: Cur;
};

/** Charge dates of a subscription strictly after `from` and up to `to`. */
export function subDates(s: Subscription, from: string, to: string) {
  const out: string[] = [];
  if (!s.active) return out;
  const f = parse(from);
  for (let k = 0; k <= 30; k++) {
    const m = f.getMonth() + k;
    if (s.cycle === "anual" && ((m % 12) + 12) % 12 !== (s.charge_month ?? 1) - 1) continue;
    const date = dayOf(f.getFullYear(), m, s.charge_day);
    if (date > to) break;
    if (date > from) out.push(date);
  }
  return out;
}
export const subMonthly = (s: Subscription) => (s.active ? (s.cycle === "anual" ? Number(s.amount) / 12 : Number(s.amount)) : 0);
export const nextCharge = (s: Subscription, today = todayStr()) =>
  subDates(s, ymd(new Date(parse(today).getTime() - 86400000)), addMonths(today, 13))[0] ?? null;
export const daysUntil = (date: string, today = todayStr()) => Math.round((parse(date).getTime() - parse(today).getTime()) / 86400000);
