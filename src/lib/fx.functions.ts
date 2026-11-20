import { createServerFn } from "@tanstack/react-start";

export type UsdRate = { rate: number; fetchedAt: string; source: string };

const PAIR = "USD_PEN";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Today's soles-per-dollar rate from ExchangeRate-API (open access, daily), else the BCRP SBS selling rate. */
async function fetchRate(): Promise<{ rate: number; source: string }> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = (await r.json()) as { result?: string; rates?: Record<string, number> };
    const rate = Number(j.rates?.["PEN"]);
    if (j.result === "success" && rate > 0) return { rate, source: "ExchangeRate-API" };
  } catch (e) {
    console.warn("fx er-api", String(e).slice(0, 120));
  }
  // Fallback: BCRP series PD04640PD = TC sistema bancario SBS, venta (S/ por US$).
  const r = await fetch("https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04640PD/json");
  const j = (await r.json()) as { periods?: { values: string[] }[] };
  const last = [...(j.periods ?? [])].reverse().find((p) => Number(p.values[0]) > 0);
  const rate = Number(last?.values[0]);
  if (!(rate > 0)) throw new Error("Sin tipo de cambio");
  return { rate, source: "BCRP" };
}

/**
 * Shared daily rate: read from the database, refreshed by the first request after 12 hours.
 * Public on purpose (the demo uses it too); it only returns a public number.
 */
export const getUsdRate = createServerFn({ method: "GET" }).handler(async (): Promise<UsdRate | { error: string }> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin.from("fx_rates").select("rate, source, fetched_at").eq("pair", PAIR).maybeSingle();
  const fresh = row && Date.now() - new Date(row.fetched_at).getTime() < MAX_AGE_MS;
  if (row && fresh) return { rate: Number(row.rate), fetchedAt: row.fetched_at, source: row.source };
  try {
    const { rate, source } = await fetchRate();
    const fetchedAt = new Date().toISOString();
    await supabaseAdmin.from("fx_rates").upsert({ pair: PAIR, rate, source, fetched_at: fetchedAt });
    return { rate, fetchedAt, source };
  } catch (e) {
    console.error("getUsdRate", e);
    // Keep working with the last stored rate when both sources fail.
    if (row) return { rate: Number(row.rate), fetchedAt: row.fetched_at, source: row.source };
    return { error: "Sin tipo de cambio" };
  }
});
