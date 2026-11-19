import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { ANUAL_PER_MONTH, ANUAL_SAVING, ANUAL_SAVING_PCT, isLimitError } from "./plans";
import { validSignature } from "./mercadopago.server";

describe("plan marketing numbers", () => {
  it("annual = S/ 6.58 a month and saves S/ 39.80 (33%) vs monthly", () => {
    expect([ANUAL_PER_MONTH, ANUAL_SAVING, ANUAL_SAVING_PCT]).toEqual([6.58, 39.8, 34]);
  });
  it("recognises the database free-limit error", () => {
    expect(isLimitError({ message: "LIMITE_GRATIS" })).toBe(true);
    expect(isLimitError({ message: "otro" })).toBe(false);
  });
});

describe("Mercado Pago webhook signature", () => {
  const secret = "s3cr3t";
  afterEach(() => delete process.env["MP_WEBHOOK_SECRET"]);
  const sign = (id: string, reqId: string, ts: string) => createHmac("sha256", secret).update(`id:${id};request-id:${reqId};ts:${ts};`).digest("hex");

  it("accepts a correctly signed notification", () => {
    process.env["MP_WEBHOOK_SECRET"] = secret;
    const h = new Headers({ "x-signature": `ts=1700000000,v1=${sign("123456", "req-1", "1700000000")}`, "x-request-id": "req-1" });
    expect(validSignature(h, "123456")).toBe(true);
  });
  it("rejects a tampered id or missing secret", () => {
    process.env["MP_WEBHOOK_SECRET"] = secret;
    const h = new Headers({ "x-signature": `ts=1700000000,v1=${sign("123456", "req-1", "1700000000")}`, "x-request-id": "req-1" });
    expect(validSignature(h, "999999")).toBe(false);
    delete process.env["MP_WEBHOOK_SECRET"];
    expect(validSignature(h, "123456")).toBe(false);
  });
});
