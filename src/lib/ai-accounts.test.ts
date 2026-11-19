import { describe, expect, it } from "vitest";
import { accountDefaults, accountsGuide, resolveAccount, type AccountRef } from "./ai-accounts";

const accounts: AccountRef[] = [
  { id: "a-bcp", name: "BCP", kind: "debito", legacy: "bcp" },
  { id: "a-io", name: "iO", kind: "credito", legacy: "io" },
  { id: "a-latam", name: "LATAM Pass", kind: "debito", legacy: null },
  { id: "a-bbva", name: "BBVA Signature", kind: "credito", legacy: null },
];

describe("accountDefaults", () => {
  it("prefers the original BCP and iO accounts", () => {
    const d = accountDefaults(accounts);
    expect([d.debit.id, d.credit.id]).toEqual(["a-bcp", "a-io"]);
  });
  it("falls back to the first account of each kind", () => {
    const d = accountDefaults(accounts.filter((a) => !a.legacy));
    expect([d.debit.id, d.credit.id]).toEqual(["a-latam", "a-bbva"]);
  });
  it("works with only one kind of account", () => {
    const d = accountDefaults([accounts[2]!]);
    expect([d.debit.id, d.credit.id]).toEqual(["a-latam", "a-latam"]);
  });
});

describe("accountsGuide", () => {
  it("lists every account with its id and type", () => {
    const g = accountsGuide(accounts, "voz");
    for (const a of accounts) expect(g).toContain(`"${a.id}": ${a.name}`);
    expect(g).toContain("tarjeta de crédito");
  });
});

describe("resolveAccount", () => {
  const base = { cuenta: "a-latam", movimiento: "ingreso" as const, monto: 5 };
  it("keeps a valid account choice", () => expect(resolveAccount(base, accounts, accounts[0]!).cuenta).toBe("a-latam"));
  it("replaces an unknown id with the fallback", () => expect(resolveAccount({ ...base, cuenta: "nope" }, accounts, accounts[0]!).cuenta).toBe("a-bcp"));
  it("credit cards are always spending", () => expect(resolveAccount({ ...base, cuenta: "a-bbva" }, accounts, accounts[0]!).movimiento).toBe("egreso"));
});
