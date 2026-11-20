import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { buildDemoData } from "@/lib/demo-data";
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

/** Tell the app that data changed (after any write), so lists and the plan counter refresh without waiting for realtime. */
export const FINANCE_CHANGED = "finance-changed";
export const financeChanged = () => window.dispatchEvent(new CustomEvent(FINANCE_CHANGED));

let ensuring: Promise<Account[]> | null = null;

/**
 * Every user has a default debit account (legacy "bcp", named "Mi cuenta", renamable): debit records saved
 * without an account belong to it. If the user already made a debit account, that one becomes the default.
 * Card records saved without an account (older versions) are given to the user's first card (legacy "io");
 * no card is created by default. Single-flight, because several loads can start at once.
 */
function ensureBaseAccounts(prof: Profile, accs: Account[], orphanCardRecords: boolean): Promise<Account[]> {
  const has = (legacy: string) => accs.some((x) => x.legacy === legacy);
  const card = accs.find((x) => x.kind === "credito" && !x.legacy && !x.archived);
  const adoptCard = orphanCardRecords && !has("io") && !!card;
  if (has("bcp") && !adoptCard) return Promise.resolve(accs);
  ensuring ??= (async () => {
    if (!has("bcp")) {
      const own = accs.find((x) => x.kind === "debito" && !x.legacy && !x.archived);
      // All columns are sent: a missing NOT NULL column would be sent as null and reject the insert.
      const { error } = own
        ? await supabase.from("accounts").update({ legacy: "bcp" }).eq("id", own.id)
        : await supabase.from("accounts").insert({ user_id: prof.user_id, name: "Mi cuenta", kind: "debito", legacy: "bcp", cut_day: prof.io_cut_day, pay_day: prof.io_pay_day });
      if (error && error.code !== "23505") console.error("ensureBaseAccounts", error.message);
    }
    if (adoptCard) {
      const { error } = await supabase.from("accounts").update({ legacy: "io" }).eq("id", card.id);
      if (error && error.code !== "23505") console.error("ensureBaseAccounts", error.message);
    }
    const { data } = await supabase.from("accounts").select("*").order("created_at");
    return (data ?? accs) as Account[];
  })().finally(() => {
    ensuring = null;
  });
  return ensuring;
}

export function useFinanceData(enabled: boolean, demo = false) {
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
    const prof = p.data as Profile | null;
    const orphanCardRecords = (i.data ?? []).some((x) => !x.account_id) || (c.data ?? []).some((x) => !x.account_id);
    const accs = prof ? await ensureBaseAccounts(prof, (a.data ?? []) as Account[], orphanCardRecords) : ((a.data ?? []) as Account[]);
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
    if (demo) {
      const d = buildDemoData();
      // Demo only: ?moneda=USD previews the app with dollars as the main currency.
      if (new URLSearchParams(window.location.search).get("moneda") === "USD") d.profile.currency = "USD";
      setProfile(d.profile); setBcp(d.bcp); setIo(d.io); setCuotas(d.cuotas); setAccounts(d.accounts); setDebts(d.debts); setSubs(d.subs);
      setLoading(false);
      return;
    }
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
    const refresh = () => void load();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(FINANCE_CHANGED, refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(FINANCE_CHANGED, refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, demo, load]);

  return { profile, bcp, io, cuotas, accounts, debts, subs, loading, reload: demo ? async () => {} : load };
}
