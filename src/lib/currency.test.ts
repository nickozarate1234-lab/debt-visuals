import { describe, expect, it } from "vitest";
import { cardPaymentOn, conv, fxFromProfile, money, project, type Account, type BcpMovement, type Profile, type Subscription } from "./finance";

const profile: Profile = {
  user_id: "u",
  shortcut_token: "t",
  mesada1_day: 15,
  mesada1_amount: 0,
  mesada2_day: 30,
  mesada2_amount: 0,
  io_cut_day: 25,
  io_pay_day: 12,
  yape_day: 15,
  yape_amount: 0,
  bbva_date: null,
  bbva_amount: 0,
  projection_months: 2,
};
const accounts: Account[] = [
  { id: "sol", name: "BCP Soles", kind: "debito", legacy: "bcp", cut_day: 0, pay_day: 0, archived: false, currency: "PEN" },
  { id: "usd", name: "BCP Dólares", kind: "debito", legacy: null, cut_day: 0, pay_day: 0, archived: false, currency: "USD" },
  { id: "card", name: "BBVA $", kind: "credito", legacy: null, cut_day: 5, pay_day: 28, archived: false, currency: "USD" },
];
const mov = (id: string, amount: number, account_id: string | null, extra: Partial<BcpMovement> = {}): BcpMovement => ({ id, seq: Number(id.slice(1)) || 1, date: "2026-11-01", concept: id, amount, account_id, ...extra });
const fx = { main: "PEN" as const, rate: 3.43 };

describe("conv", () => {
  it("converts dollars to soles and back", () => {
    expect(conv(800, "USD", fx)).toBeCloseTo(2744);
    expect(conv(343, "PEN", fx, "USD")).toBeCloseTo(100);
    expect(conv(50, "PEN", fx)).toBe(50);
  });
  it("uses the user's own rate when set, else the automatic one", () => {
    expect(fxFromProfile({ currency: "PEN", usd_rate: 3.5 }, 3.43).rate).toBe(3.5);
    expect(fxFromProfile({ currency: "USD", usd_rate: null }, 3.43)).toEqual({ main: "USD", rate: 3.43 });
  });
  it("formats each currency with its symbol", () => {
    expect(money(12.5, false, "USD")).toBe("US$ 12.50");
    expect(money(-3, true)).toBe("−S/ 3.00");
  });
});

describe("projection in the main currency", () => {
  const bcp = [mov("m1", 1900, "sol"), mov("m2", 800, "usd")];

  it("starts from all debit balances converted (1,900 + 800 × 3.43)", () => {
    expect(project(profile, bcp, [], [], "2026-11-20", accounts, [], [], fx).start).toBeCloseTo(4644);
  });

  it("converts a salary in dollars and keeps its original amount", () => {
    const p = { ...profile, mesada1_amount: 300, mesada1_currency: "USD" as const };
    const ev = project(p, bcp, [], [], "2026-11-20", accounts, [], [], fx).events.find((e) => e.concept === "Sueldo")!;
    expect(ev.amount).toBeCloseTo(1029);
    expect(ev).toMatchObject({ cur: "USD", original: 300 });
  });

  it("charges a dollar subscription converted", () => {
    const sub: Subscription = { id: "s", name: "Claude", amount: 20, cycle: "mensual", charge_day: 25, charge_month: null, category: "Otros", pay_account_id: "sol", active: true, currency: "USD" };
    const ev = project(profile, bcp, [], [], "2026-11-20", accounts, [], [sub], fx).events.find((e) => e.concept === "Suscripción Claude")!;
    expect(ev.amount).toBeCloseTo(-68.6);
  });

  it("projects a subscription paid with a card on that card's pay date, not on the charge date", () => {
    const sub: Subscription = { id: "s", name: "Netflix", amount: 10, cycle: "mensual", charge_day: 3, charge_month: null, category: "Suscripciones", pay_account_id: "card", active: true, currency: "USD" };
    const evs = project({ ...profile, projection_months: 3 }, bcp, [], [], "2026-11-20", accounts, [], [sub], fx).events.filter((e) => e.concept.startsWith("Suscripción Netflix"));
    // Charged 03/12 (before the cut on the 5th) → paid 28/01; the 03/01 charge is paid 28/02, after the 3-month window.
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ date: "2027-01-28", concept: "Suscripción Netflix (BBVA $)", cur: "USD", original: -10 });
    expect(evs[0]!.amount).toBeCloseTo(-34.3);
  });

  it("shows everything in dollars when that is the main currency", () => {
    expect(project(profile, bcp, [], [], "2026-11-20", accounts, [], [], { main: "USD", rate: 3.43 }).start).toBeCloseTo(1900 / 3.43 + 800);
  });

  it("pays a dollar card statement converted", () => {
    const io = [{ id: "e", date: "2026-11-02", description: "Amazon", category: "Otros", amount: 45, account_id: "card" }];
    const ev = project(profile, bcp, io, [], "2026-11-20", accounts, [], [], fx).events.find((e) => e.concept.startsWith("Pago BBVA $"))!;
    expect(ev.amount).toBeCloseTo(-154.35);
    expect(ev.original).toBe(-45);
  });
});

describe("paying a dollar card from a soles account", () => {
  it("credits the card with card_amount, not the soles that left the account", () => {
    const io = [{ id: "e", date: "2026-10-03", description: "Amazon", category: "Otros", amount: 45, account_id: "card" }];
    const pay = mov("m3", -102.9, "sol", { paid_card_id: "card", card_amount: 30, date: "2026-11-20" });
    expect(cardPaymentOn(accounts[2]!, "2026-11-28", accounts, io, [], [pay], "2026-11-20")).toMatchObject({ paid: 30, due: 15 });
  });
});
