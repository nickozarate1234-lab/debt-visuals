import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Account, BcpMovement, Debt, Installment, IoExpense, Profile, Subscription } from "@/lib/finance";

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, b, i, c, a, d, sb] = await Promise.all([
      supabase.from("profiles").select("*").maybeSingle(),
      supabase.from("bcp_movements").select("id, seq, date, concept, amount, account_id, transfer_id, paid_card_id").order("seq"),
      supabase.from("io_expenses").select("id, date, description, category, amount, account_id").order("date", { ascending: false }),
      supabase.from("installments").select("*").order("first_date"),
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("debts").select("*").order("created_at"),
      supabase.from("subscriptions").select("*").order("charge_day"),
    ]);
    let accs = (a.data ?? []) as Account[];
    const prof = p.data as Profile | null;
    if (prof && !accs.some((x) => x.legacy === "bcp") && !accs.some((x) => x.legacy === "io")) {
      const { data } = await supabase
        .from("accounts")
        .insert([
          { user_id: prof.user_id, name: "BCP", kind: "debito", legacy: "bcp" },
          { user_id: prof.user_id, name: "iO", kind: "credito", legacy: "io", cut_day: prof.io_cut_day, pay_day: prof.io_pay_day },
        ])
        .select("*");
      accs = (data ?? []) as Account[];
    }
    setAccounts(accs);
    setDebts((d.data ?? []) as Debt[]);
    setProfile(p.data as Profile | null);
    setBcp((b.data ?? []) as BcpMovement[]);
    setIo((i.data ?? []) as IoExpense[]);
    setCuotas((c.data ?? []) as Installment[]);
    setSubs((sb.data ?? []) as Subscription[]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "debts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, load)
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, load]);

  return { profile, bcp, io, cuotas, accounts, debts, subs, loading, reload: load };
}
