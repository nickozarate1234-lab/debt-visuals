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
export type BcpMovement = { id: string; seq: number; date: string | null; concept: string; amount: number };
export type IoExpense = { id: string; date: string; description: string; category: string; amount: number };
export type Installment = {
  id: string;
  concept: string;
  original_amount: number;
  num_installments: number;
  monthly_amount: number;
  first_date: string;
};

export const IO_CATEGORIES = ["Comida", "Transporte", "Suscripciones", "Entretenimiento", "Salud", "Otros"];

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
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

export const installmentLast = (i: Installment) => addMonths(i.first_date, i.num_installments - 1);
export const installmentActive = (i: Installment, today = todayStr()) => today <= installmentLast(i);

export const withBalances = (rows: BcpMovement[]) => {
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  let bal = 0;
  return sorted.map((r) => ({ ...r, balance: (bal += Number(r.amount)) }));
};
export const currentBalance = (rows: BcpMovement[]) => rows.reduce((s, r) => s + Number(r.amount), 0);

export const ioPaymentOn = (date: string, io: IoExpense[], cuotas: Installment[], p: Profile) => {
  const gastos = io.filter((e) => ioPayDate(e.date, p) === date).reduce((s, e) => s + Number(e.amount), 0);
  const day = parse(date).getDate();
  const cuo = cuotas
    .filter((c) => c.first_date <= date && installmentLast(c) >= date && parse(c.first_date).getDate() === day)
    .reduce((s, c) => s + Number(c.monthly_amount), 0);
  return { gastos, cuotas: cuo, total: gastos + cuo };
};

export type ProjEvent = { date: string; concept: string; amount: number; balance: number };

export function project(p: Profile, bcp: BcpMovement[], io: IoExpense[], cuotas: Installment[], today = todayStr()) {
  const start = currentBalance(bcp);
  const raw: Omit<ProjEvent, "balance">[] = [];
  const t = parse(today);
  for (let k = 0; k <= p.projection_months; k++) {
    const y = t.getFullYear();
    const m = t.getMonth() + k;
    raw.push({ date: dayOf(y, m, p.mesada1_day), concept: "Mesada", amount: Number(p.mesada1_amount) });
    raw.push({ date: dayOf(y, m, p.mesada2_day), concept: "Mesada", amount: Number(p.mesada2_amount) });
    if (Number(p.yape_amount) > 0)
      raw.push({ date: dayOf(y, m, p.yape_day), concept: "Cuota Yape", amount: -Number(p.yape_amount) });
    const payDate = dayOf(y, m, p.io_pay_day);
    const pay = ioPaymentOn(payDate, io, cuotas, p);
    if (pay.total !== 0) raw.push({ date: payDate, concept: "Pago iO (gastos + cuotas)", amount: -pay.total });
  }
  if (p.bbva_date && Number(p.bbva_amount) > 0)
    raw.push({ date: p.bbva_date, concept: "Pago BBVA (único)", amount: -Number(p.bbva_amount) });

  const limit = addMonths(today, p.projection_months);
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
