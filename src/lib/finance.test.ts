import { describe, expect, it } from "vitest";
import {
  cardPaymentOn,
  installmentActive,
  installmentDueDates,
  installmentLast,
  ioPayDate,
  ioPaymentOn,
  nextPayDate,
  project,
  type Account,
  type Installment,
  type Profile,
} from "./finance";

const cuota = (first_date: string, num_installments = 3, monthly_amount = 100, account_id: string | null = null): Installment => ({
  id: `c-${first_date}`,
  concept: "Compra",
  original_amount: monthly_amount * num_installments,
  num_installments,
  monthly_amount,
  first_date,
  account_id,
});

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
  projection_months: 6,
};

describe("nextPayDate", () => {
  it("keeps a date that already is a pay date", () => expect(nextPayDate("2026-11-12", 12)).toBe("2026-11-12"));
  it("moves to the same month when the pay day is still ahead", () => expect(nextPayDate("2026-11-05", 12)).toBe("2026-11-12"));
  it("moves to next month when the pay day already passed", () => expect(nextPayDate("2026-11-18", 12)).toBe("2026-12-12"));
  it("clamps pay day 31 to short months", () => expect(nextPayDate("2027-02-10", 31)).toBe("2027-02-28"));
});

describe("ioPayDate", () => {
  const io = { io_cut_day: 25, io_pay_day: 12 };
  const bbva = { io_cut_day: 5, io_pay_day: 28 };
  it("pay day before the cut: paid next month", () => {
    expect(ioPayDate("2026-11-14", io)).toBe("2026-12-12");
    expect(ioPayDate("2026-11-25", io)).toBe("2026-12-12");
    expect(ioPayDate("2026-11-26", io)).toBe("2027-01-12");
  });
  it("pay day after the cut: paid the same month as the cut", () => {
    expect(ioPayDate("2026-12-03", bbva)).toBe("2026-12-28");
    expect(ioPayDate("2026-12-05", bbva)).toBe("2026-12-28");
    expect(ioPayDate("2026-11-14", bbva)).toBe("2026-12-28");
  });
  it("same cut and pay day: paid next month", () => expect(ioPayDate("2026-11-10", { io_cut_day: 15, io_pay_day: 15 })).toBe("2026-12-15"));
  it("clamps day 31 in short months", () => expect(ioPayDate("2027-02-10", { io_cut_day: 31, io_pay_day: 20 })).toBe("2027-03-20"));
});

describe("installmentDueDates", () => {
  it("first cuota on the pay day: unchanged schedule (existing data)", () => {
    expect(installmentDueDates(cuota("2026-10-12"), 12)).toEqual(["2026-10-12", "2026-11-12", "2026-12-12"]);
  });
  it("first cuota on any other day is billed on the next pay dates", () => {
    expect(installmentDueDates(cuota("2026-11-18"), 12)).toEqual(["2026-12-12", "2027-01-12", "2027-02-12"]);
  });
  it("never bills two cuotas on the same pay date around month ends", () => {
    const due = installmentDueDates(cuota("2027-01-31", 4), 30);
    expect(due).toEqual(["2027-02-28", "2027-03-30", "2027-04-30", "2027-05-30"]);
    expect(new Set(due).size).toBe(due.length);
  });
  it("handles zero installments", () => expect(installmentDueDates(cuota("2026-11-18", 0), 12)).toEqual([]));
  it("last date and active status follow the card schedule", () => {
    const c = cuota("2026-11-18");
    expect(installmentLast(c, 12)).toBe("2027-02-12");
    expect(installmentActive(c, "2027-02-12", 12)).toBe(true);
    expect(installmentActive(c, "2027-02-13", 12)).toBe(false);
  });
});

describe("ioPaymentOn counts cuotas whatever day they were entered", () => {
  const cuotas = [cuota("2026-11-18", 3, 150), cuota("2026-10-12", 3, 40)];
  it("sums both cuotas on a shared pay date", () => {
    expect(ioPaymentOn("2026-12-12", [], cuotas, profile).cuotas).toBe(190);
  });
  it("stops after the last cuota", () => {
    expect(ioPaymentOn("2027-01-12", [], cuotas, profile).cuotas).toBe(150);
    expect(ioPaymentOn("2027-03-12", [], cuotas, profile).cuotas).toBe(0);
  });
  it("adds card expenses and cuotas together", () => {
    const io = [{ id: "e1", date: "2026-11-20", description: "Tambo", category: "Comida", amount: 12.4 }];
    expect(ioPaymentOn("2026-12-12", io, cuotas, profile).total).toBeCloseTo(202.4);
  });
});

describe("cards with their own cycle", () => {
  const accounts: Account[] = [
    { id: "bcp", name: "BCP", kind: "debito", legacy: "bcp", cut_day: 0, pay_day: 0, archived: false },
    { id: "io", name: "iO", kind: "credito", legacy: "io", cut_day: 25, pay_day: 12, archived: false },
    { id: "bbva", name: "BBVA", kind: "credito", legacy: null, cut_day: 5, pay_day: 28, archived: false },
  ];
  const bbva = accounts[2]!;
  const cuotas = [cuota("2026-11-18", 12, 400, "bbva")];

  it("bills a BBVA cuota entered on the purchase day on BBVA's pay day", () => {
    expect(cardPaymentOn(bbva, "2026-11-28", accounts, [], cuotas, []).due).toBe(400);
    expect(cardPaymentOn(bbva, "2026-12-28", accounts, [], cuotas, []).due).toBe(400);
  });

  it("the projection includes the cuota payments", () => {
    const pay = project({ ...profile, projection_months: 3 }, [], [], cuotas, "2026-11-18", accounts).events.filter((e) => e.concept.startsWith("Pago BBVA"));
    // 3-month window from 2026-11-18 ends 2027-02-18, so February's payment is outside it.
    expect(pay.map((e) => [e.date, e.amount])).toEqual([
      ["2026-11-28", -400],
      ["2026-12-28", -400],
      ["2027-01-28", -400],
    ]);
  });
});

describe("cuotaRate (French system, like the bank quote)", () => {
  it("finds the monthly rate that matches the quoted cuota", async () => {
    const { cuotaRate } = await import("./finance");
    const r = cuotaRate(244.7, 90.03, 3)!;
    const pv = (90.03 * (1 - Math.pow(1 + r.tem, -3))) / r.tem;
    expect(pv).toBeCloseTo(244.7, 2);
    expect(r.interest).toBeCloseTo(25.39, 2);
    expect(r.tea).toBeGreaterThan(r.tem * 12); // compounding
  });
  it("zero interest when cuotas add up to the purchase", async () => {
    const { cuotaRate } = await import("./finance");
    expect(cuotaRate(300, 100, 3)).toMatchObject({ tem: 0, tea: 0, interest: 0 });
  });
  it("rejects nonsense", async () => {
    const { cuotaRate } = await import("./finance");
    expect(cuotaRate(0, 100, 3)).toBeNull();
    expect(cuotaRate(100, 0, 3)).toBeNull();
  });
});

describe("installmentStatus and the credit line", () => {
  const momo: Installment = { id: "m", concept: "Momo", original_amount: 261, num_installments: 3, monthly_amount: 95.7, first_date: "2026-12-12", account_id: "io" };
  it("nothing paid before the first pay date: the whole purchase uses the line", async () => {
    const { installmentStatus } = await import("./finance");
    const s = installmentStatus(momo, 12, "2026-11-18");
    expect([s.paid, s.remaining, s.next]).toEqual([0, 3, "2026-12-12"]);
    expect(s.principal).toBeCloseTo(261, 1);
  });
  it("each cuota paid releases its capital part", async () => {
    const { installmentStatus } = await import("./finance");
    const one = installmentStatus(momo, 12, "2026-12-13");
    const two = installmentStatus(momo, 12, "2027-01-13");
    const done = installmentStatus(momo, 12, "2027-02-13");
    expect([one.paid, two.paid, done.paid]).toEqual([1, 2, 3]);
    expect(one.principal).toBeLessThan(261);
    expect(two.principal).toBeLessThan(one.principal);
    expect(two.principal).toBeLessThan(95.7); // last cuota = its capital + that month's interest
    expect(done.principal).toBe(0);
  });
  it("card credit used = unpaid purchases + capital left in cuotas", async () => {
    const { cardCreditUsed } = await import("./finance");
    const io: Account = { id: "io", name: "iO", kind: "credito", legacy: "io", cut_day: 25, pay_day: 12, archived: false, credit_limit: 5000 };
    const accounts: Account[] = [io];
    const spend = [
      { id: "e1", date: "2026-11-10", description: "Wong", category: "Comida", amount: 100, account_id: "io" }, // pays 2026-12-12: unpaid
      { id: "e2", date: "2026-10-01", description: "Old", category: "Comida", amount: 50, account_id: "io" }, // paid on 2026-11-12
    ];
    const r = cardCreditUsed(io, accounts, spend, [momo], [], "2026-11-18");
    expect(r.gastos).toBe(100);
    expect(r.cuotas).toBeCloseTo(261, 1);
    expect(r.available).toBeCloseTo(5000 - 361, 1);
  });
});
