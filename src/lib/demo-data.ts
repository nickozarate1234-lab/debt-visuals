import { addMonths, todayStr, type Account, type BcpMovement, type Debt, type Installment, type IoExpense, type Profile, type Subscription } from "@/lib/finance";

/** Fictional, always-fresh demo profile (dates relative to today). Never touches the database. */
export const DEMO_USER_ID = "demo";

const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function buildDemoData() {
  const today = todayStr();
  const profile: Profile = {
    user_id: DEMO_USER_ID,
    shortcut_token: "demo",
    mesada1_day: 15,
    mesada1_amount: 3200,
    mesada2_day: 30,
    mesada2_amount: 3200,
    io_cut_day: 25,
    io_pay_day: 12,
    yape_day: 15,
    yape_amount: 0,
    bbva_date: null,
    bbva_amount: 0,
    projection_months: 6,
  };
  const accounts: Account[] = [
    { id: "d-bcp", name: "BCP Sueldo", kind: "debito", legacy: "bcp", cut_day: 0, pay_day: 0, archived: false },
    { id: "d-ibk", name: "Interbank Ahorro", kind: "debito", legacy: null, cut_day: 0, pay_day: 0, archived: false },
    { id: "d-io", name: "iO Visa", kind: "credito", legacy: "io", cut_day: 25, pay_day: 12, archived: false, credit_limit: 3000 },
    { id: "d-bbva", name: "BBVA Signature", kind: "credito", legacy: null, cut_day: 5, pay_day: 28, archived: false, credit_limit: 8000 },
  ];
  const mv: [number, string, number, string][] = [
    [-60, "Saldo inicial", 5200, "d-bcp"],
    [-60, "Saldo inicial", 8500, "d-ibk"],
    [-46, "Sueldo", 3200, "d-bcp"],
    [-40, "Alquiler depa", -1400, "d-bcp"],
    [-31, "Sueldo", 3200, "d-bcp"],
    [-28, "Ahorro mensual", -1000, "d-bcp"],
    [-28, "Ahorro mensual", 1000, "d-ibk"],
    [-22, "Freelance diseño", 1250, "d-bcp"],
    [-16, "Sueldo", 3200, "d-bcp"],
    [-14, "Pago iO Visa", -890, "d-bcp"],
    [-10, "Alquiler depa", -1400, "d-bcp"],
    [-6, "Yape a Diego (cena)", -45, "d-bcp"],
    [-3, "Dividendos fondo", 320, "d-ibk"],
    [-1, "Sueldo", 3200, "d-bcp"],
  ];
  const bcp: BcpMovement[] = mv.map(([d, concept, amount, account_id], i) => ({
    id: `d-m${i}`, seq: i + 1, date: shift(d), concept, amount, account_id, transfer_id: null, paid_card_id: null,
  }));
  const ex: [number, string, string, number, string][] = [
    [-1, "Starbucks Larcomar", "Comida", 18.5, "d-io"],
    [-2, "Wong Miraflores", "Comida", 142.3, "d-io"],
    [-3, "Uber", "Transporte", 16.9, "d-io"],
    [-5, "SmartFit", "Salud", 119, "d-io"],
    [-7, "Cineplanet", "Entretenimiento", 48, "d-bbva"],
    [-8, "Central Restaurante", "Comida", 210, "d-bbva"],
    [-11, "Tambo", "Comida", 12.4, "d-io"],
    [-13, "Inkafarma", "Salud", 36.8, "d-io"],
    [-15, "Rappi sushi", "Comida", 64, "d-io"],
    [-18, "Cabify aeropuerto", "Transporte", 42, "d-io"],
  ];
  const io: IoExpense[] = ex.map(([d, description, category, amount, account_id], i) => ({
    id: `d-e${i}`, date: shift(d), description, category, amount, account_id,
  }));
  const cuotas: Installment[] = [
    { id: "d-c1", concept: "MacBook Air M4", original_amount: 4800, num_installments: 12, monthly_amount: 400, first_date: addMonths(today, -3), account_id: "d-bbva" },
    { id: "d-c2", concept: "AirPods Pro", original_amount: 900, num_installments: 6, monthly_amount: 150, first_date: addMonths(today, -1), account_id: "d-io" },
  ];
  const debts: Debt[] = [
    { id: "d-d1", name: "Préstamo auto (casi listo)", monthly_amount: 350, pay_day: 20, start_date: addMonths(today, -20), num_payments: 24, pay_account_id: "d-bcp" },
  ];
  const subs: Subscription[] = [
    { id: "d-s1", name: "Spotify", amount: 11.9, cycle: "mensual", charge_day: 21, charge_month: null, category: "Suscripciones", pay_account_id: "d-io", active: true },
    { id: "d-s2", name: "Netflix", amount: 44.9, cycle: "mensual", charge_day: 8, charge_month: null, category: "Suscripciones", pay_account_id: "d-io", active: true },
    { id: "d-s3", name: "ChatGPT Plus", amount: 75, cycle: "mensual", charge_day: 3, charge_month: null, category: "Suscripciones", pay_account_id: "d-bbva", active: true },
    { id: "d-s4", name: "iCloud+ 200GB", amount: 11.9, cycle: "mensual", charge_day: 17, charge_month: null, category: "Suscripciones", pay_account_id: "d-bcp", active: true },
  ];
  return { profile, bcp, io, cuotas, accounts, debts, subs };
}
