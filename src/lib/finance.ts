export type Profile = {
  user_id: string;
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
};
export type IoExpense = { id: string; date: string; description: string; category: string; amount: number; account_id?: string | null };
export type Account = { id: string; name: string; kind: "debito" | "credito"; legacy: string | null; cut_day: number; pay_day: number; archived: boolean };
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

export const money = (n: number, sign = false) => {
  const s = `S/ ${Math.abs(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export const withBalances = (rows: BcpMovement[]) => {
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
    .reduce((s, r) => s - Number(r.amount), 0);
  return { ...base, paid, due: Math.max(0, base.total - paid) };
}

export type ProjEvent = { date: string; concept: string; amount: number; balance: number };

export function project(
  p: Profile,
  bcp: BcpMovement[],
  io: IoExpense[],
  cuotas: Installment[],
  today = todayStr(),
  accounts: Account[] = [],
  debts: Debt[] = [],
  subs: Subscription[] = [],
) {
  const start = currentBalance(bcp);
  const raw: Omit<ProjEvent, "balance">[] = [];
  const t = parse(today);
  const limit = addMonths(today, p.projection_months);
  const cards = accounts.filter((a) => a.kind === "credito" && !a.archived);
  for (let k = 0; k <= p.projection_months; k++) {
    const y = t.getFullYear();
    const m = t.getMonth() + k;
    raw.push({ date: dayOf(y, m, p.mesada1_day), concept: "Mesada", amount: Number(p.mesada1_amount) });
    raw.push({ date: dayOf(y, m, p.mesada2_day), concept: "Mesada", amount: Number(p.mesada2_amount) });
    for (const c of cards) {
      const payDate = dayOf(y, m, c.pay_day);
      const pay = cardPaymentOn(c, payDate, accounts, io, cuotas, bcp, today);
      if (pay.due !== 0) raw.push({ date: payDate, concept: `Pago ${c.name} (gastos + cuotas)`, amount: -pay.due });
    }
  }
  for (const d of debts)
    for (const date of debtDates(d, today, limit)) raw.push({ date, concept: d.name, amount: -Number(d.monthly_amount) });

  for (const s of subs) {
    const acc = accounts.find((a) => a.id === s.pay_account_id);
    if (acc?.kind === "credito") continue; // charged on the card; shows up in the card payment once registered
    for (const date of subDates(s, today, limit)) raw.push({ date, concept: `Suscripción ${s.name}`, amount: -Number(s.amount) });
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
