import { createContext, useContext, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DEFAULT_FX, type Fx } from "@/lib/finance";
import { getUsdRate } from "@/lib/fx.functions";

/** Used only if the rate was never fetched (no network on first open). Marked as approximate in the UI. */
export const FALLBACK_USD_RATE = 3.75;
const KEY = "fx-usd-pen";

export type AutoRate = { rate: number; fetchedAt: string | null; source: string | null; approx: boolean };

const readCache = (): AutoRate | null => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as AutoRate | null;
    return v && v.rate > 0 ? v : null;
  } catch {
    return null;
  }
};

/** Today's automatic soles-per-dollar rate (shared daily rate from the server, cached on the device). */
export function useAutoRate(): AutoRate {
  const get = useServerFn(getUsdRate);
  const [auto, setAuto] = useState<AutoRate>({ rate: FALLBACK_USD_RATE, fetchedAt: null, source: null, approx: true });
  useEffect(() => {
    const cached = readCache();
    if (cached) setAuto(cached);
    void get()
      .then((r) => {
        if ("error" in r) return;
        const next = { rate: r.rate, fetchedAt: r.fetchedAt, source: r.source, approx: false };
        setAuto(next);
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* storage unavailable: keep it in memory */
        }
      })
      .catch(() => undefined);
  }, [get]);
  return auto;
}

type FxValue = { fx: Fx; auto: AutoRate };
export const FxContext = createContext<FxValue>({ fx: DEFAULT_FX, auto: { rate: FALLBACK_USD_RATE, fetchedAt: null, source: null, approx: true } });
/** Main currency and exchange rate in use (own rate if the user set one, else today's automatic one). */
export const useFx = () => useContext(FxContext);
