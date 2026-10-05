import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { BcpMovement, Installment, IoExpense, Profile } from "@/lib/finance";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

export function useFinanceData(enabled: boolean) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bcp, setBcp] = useState<BcpMovement[]>([]);
  const [io, setIo] = useState<IoExpense[]>([]);
  const [cuotas, setCuotas] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, b, i, c] = await Promise.all([
      supabase.from("profiles").select("*").maybeSingle(),
      supabase.from("bcp_movements").select("id, seq, date, concept, amount").order("seq"),
      supabase.from("io_expenses").select("id, date, description, category, amount").order("date", { ascending: false }),
      supabase.from("installments").select("*").order("first_date"),
    ]);
    setProfile(p.data as Profile | null);
    setBcp((b.data ?? []) as BcpMovement[]);
    setIo((i.data ?? []) as IoExpense[]);
    setCuotas((c.data ?? []) as Installment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    supabase.rpc("init_my_account").then(load);
    const ch = supabase
      .channel("finanzas")
      .on("postgres_changes", { event: "*", schema: "public", table: "bcp_movements" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "io_expenses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "installments" }, load)
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, load]);

  return { profile, bcp, io, cuotas, loading, reload: load };
}
