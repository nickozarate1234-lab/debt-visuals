import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DEMO_USER_ID } from "@/lib/demo-data";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CreditCard, LineChart, Plus, Receipt, Settings, Trash2, Wallet, Home, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceData, useSession } from "@/hooks/use-finance";
import { AuthScreen } from "@/components/finanzas/AuthScreen";
import { AddDialog, type AddKind } from "@/components/finanzas/AddDialog";
import { VoiceButton } from "@/components/finanzas/VoiceButton";
import { VoucherButton } from "@/components/finanzas/VoucherButton";
import { SubscriptionsView } from "@/components/finanzas/SubscriptionsView";
import { SettingsSheet } from "@/components/finanzas/SettingsSheet";
import {
  cardOf,
  cardPaymentOn,
  cycle,
  debitOf,
  debtDates,
  debtRemaining,
  addMonths,
  type Account,
  type Debt,
  currentBalance,
  fmtDate,
  installmentActive,
  installmentDueDates,
  installmentLast,
  ioPayDate,
  ioPaymentOn,
  money,
  project,
  todayStr,
  withBalances,
  type Profile,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mis Finanzas — cuentas, tarjetas y proyección" },
      { name: "description", content: "Saldo BCP, gastos con tarjeta iO, cuotas y proyección de saldo en un solo lugar." },
      { property: "og:title", content: "Mis Finanzas" },
      { property: "og:description", content: "Saldo BCP, gastos iO, cuotas y proyección de saldo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Tab = "resumen" | "liquidez" | "io" | "cuotas" | "proyeccion" | "subs";
const TABS: { id: Tab; l: string; icon: typeof Home }[] = [
  { id: "resumen", l: "Resumen", icon: Home },
  { id: "liquidez", l: "Liquidez", icon: Wallet },
  { id: "io", l: "Tarjetas", icon: CreditCard },
  { id: "cuotas", l: "Deudas", icon: Receipt },
  { id: "subs", l: "Suscrip.", icon: Repeat },
  { id: "proyeccion", l: "Proyección", icon: LineChart },
];

function Index() {
  const { session, ready } = useSession();
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).get("demo") === "true");
  }, []);
  if (demo) return <App userId={DEMO_USER_ID} demo />;
  if (!ready) return <div className="min-h-screen" />;
  if (!session) return <AuthScreen />;
  return <App userId={session.user.id} />;
}

const Amount = ({ n, className }: { n: number; className?: string }) => (
  <span className={cn("num font-semibold", n >= 0 ? "text-income" : "text-expense", className)}>{money(n, true)}</span>
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("glass rounded-3xl", className)}>{children}</div>
);

function Row({ title, sub, right, onDelete }: { title: string; sub: string; right: React.ReactNode; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium capitalize-first">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
      </div>
      <div className="text-right">{right}</div>
      {onDelete && (
        <button onClick={onDelete} aria-label="Eliminar" className="text-muted-foreground/60 hover:text-destructive">
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}

async function del(table: "bcp_movements" | "io_expenses" | "installments" | "debts", id: string, transferId?: string | null) {
  if (!confirm("¿Eliminar este registro?")) return;
  const { error } = transferId
    ? await supabase.from("bcp_movements").delete().eq("transfer_id", transferId)
    : await supabase.from(table).delete().eq("id", id);
  if (error) toast.error(error.message);
}

function App({ userId, demo = false }: { userId: string; demo?: boolean }) {
  const { profile, bcp, io, cuotas, accounts, debts, subs, loading, reload } = useFinanceData(!demo, demo);
  const [tab, setTab] = useState<Tab>("resumen");
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<AddKind>("io");
  const [settings, setSettings] = useState(false);
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);

  const openAdd = () => {
    setAddKind(tab === "liquidez" ? "bcp" : tab === "cuotas" ? "deuda" : "io");
    setAddOpen(true);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col">
      <header className="glass-bar sticky top-3 z-20 mx-3 mt-3 flex items-center justify-between rounded-full px-5 py-3">
        <h1 className="font-display text-xl font-bold">Mis Finanzas</h1>
        <div className="flex items-center gap-2">
          <VoucherButton userId={userId} accounts={activeAccounts} />
          <button onClick={() => setSettings(true)} aria-label="Info fija" className="rounded-full p-2 hover:bg-muted">
            <Settings className="size-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 pt-4 pb-32">
        {loading || !profile ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass h-24 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : (
          <Views tab={tab} profile={profile} bcp={bcp} io={io} cuotas={cuotas} accounts={accounts} debts={debts} subs={subs} userId={userId} />
        )}
      </main>

      <button
        onClick={openAdd}
        aria-label="Agregar"
        className="fixed right-5 bottom-28 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition active:scale-95 sm:right-[calc(50%-17rem)]"
      >
        <Plus className="size-7" />
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="glass-bar mx-auto grid max-w-xl grid-cols-6 rounded-full px-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("m-1 flex flex-col items-center gap-0.5 rounded-full py-2 text-[10px] font-medium transition", tab === t.id ? "glass-pill text-primary" : "text-muted-foreground")}>
              <t.icon className="size-[18px]" strokeWidth={1.6} />
              {t.l}
            </button>
          ))}
        </div>
      </nav>

      <AddDialog open={addOpen} onOpenChange={setAddOpen} kind={addKind} setKind={setAddKind} userId={userId} accounts={accounts} />
      <VoiceButton userId={userId} accounts={activeAccounts} />
      {profile && <SettingsSheet open={settings} onOpenChange={setSettings} profile={profile} accounts={accounts} onSaved={reload} />}
    </div>
  );
}

type Data = Pick<ReturnType<typeof useFinanceData>, "bcp" | "io" | "cuotas" | "accounts" | "debts" | "subs">;

function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  if (options.length < 2) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", value === o.v ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Views({ tab, profile, bcp, io, cuotas, accounts, debts, subs, userId }: { tab: Tab; profile: Profile; userId: string } & Data) {
  const today = todayStr();
  const proj = useMemo(() => project(profile, bcp, io, cuotas, today, accounts, debts, subs), [profile, bcp, io, cuotas, today, accounts, debts, subs]);
  const bal = currentBalance(bcp);
  const debits = accounts.filter((a) => a.kind === "debito");
  const cards = accounts.filter((a) => a.kind === "credito" && !a.archived);
  const nameOf = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "";
  const [acc, setAcc] = useState("all");
  const rows = useMemo(
    () => withBalances(acc === "all" ? bcp : bcp.filter((r) => debitOf(r, accounts) === acc)).reverse(),
    [bcp, acc, accounts],
  );
  const payDayOf = (c: { account_id?: string | null }) => accounts.find((a) => a.id === cardOf(c, accounts))?.pay_day;
  const active = cuotas.filter((c) => installmentActive(c, today, payDayOf(c)));
  const multi = debits.length > 1;

  if (tab === "subs") return <SubscriptionsView subs={subs} accounts={accounts} userId={userId} />;

  if (tab === "resumen") {
    const ok = proj.min30.balance >= 0;
    const nextPays = cards
      .map((c) => {
        const ev = proj.events.find((e) => e.concept.startsWith(`Pago ${c.name} (`));
        return ev ? { c, date: ev.date, pay: cardPaymentOn(c, ev.date, accounts, io, cuotas, bcp, today) } : null;
      })
      .filter((x) => x !== null);
    return (
      <>
        <div className="bg-hero rounded-3xl border p-6">
          <div className="text-sm text-muted-foreground">{multi ? "Liquidez total" : `Saldo ${debits[0]?.name ?? "BCP"} actual`}</div>
          <div className={cn("num font-display mt-1 text-4xl font-bold", bal < 0 && "text-expense")}>{money(bal)}</div>
          {multi && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {debits.filter((a) => !a.archived).map((a) => (
                <span key={a.id}>
                  {a.name} <span className="num text-foreground">{money(currentBalance(bcp.filter((r) => debitOf(r, accounts) === a.id)))}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <Card className={cn("flex items-start gap-3 p-4", ok ? "border-income/30 bg-income/10" : "border-expense/40 bg-expense/10")}>
          {ok ? <CheckCircle2 className="mt-0.5 size-5 text-income" /> : <AlertTriangle className="mt-0.5 size-5 text-expense" />}
          <div>
            <div className={cn("font-semibold", ok ? "text-income" : "text-expense")}>
              {ok ? "Cubierto los próximos 30 días" : "Vas a quedar en negativo en los próximos 30 días"}
            </div>
            <div className="text-sm text-muted-foreground">
              Mínimo: <span className="num">{money(proj.min30.balance)}</span> el {fmtDate(proj.min30.date)}
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          {nextPays.map(({ c, date, pay }) => (
            <Card key={c.id} className="p-4">
              <div className="text-xs text-muted-foreground">Próximo pago {c.name}</div>
              <div className="num font-display mt-1 text-xl font-bold text-expense">{money(pay.due)}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(date)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground num">
                Gastos {money(pay.gastos)} · Cuotas {money(pay.cuotas)}
                {pay.paid > 0 && ` · Pagado ${money(pay.paid)}`}
              </div>
            </Card>
          ))}
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Mínimo en {profile.projection_months} meses</div>
            <div className={cn("num font-display mt-1 text-xl font-bold", proj.min.balance < 0 ? "text-expense" : "text-income")}>{money(proj.min.balance)}</div>
            <div className="text-xs text-muted-foreground">{fmtDate(proj.min.date)}</div>
          </Card>
        </div>
        <Card className="p-4">
          <div className="mb-2 text-xs text-muted-foreground">Cuotas y deudas activas</div>
          {active.length || debts.length ? (
            <div className="flex flex-wrap gap-2">
              {active.map((c) => (
                <span key={c.id} className="rounded-full bg-muted px-3 py-1 text-sm">{c.concept}</span>
              ))}
              {debts.map((d) => (
                <span key={d.id} className="rounded-full bg-muted px-3 py-1 text-sm">{d.name}</span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Ninguna</div>
          )}
        </Card>
        <Card>
          <div className="px-4 pt-4 pb-1 text-xs text-muted-foreground">Últimos movimientos</div>
          {rows.slice(0, 6).map((r) => (
            <Row key={r.id} title={r.concept} sub={`${fmtDate(r.date)}${multi ? ` · ${nameOf(debitOf(r, accounts))}` : ""}`} right={<Amount n={Number(r.amount)} />} />
          ))}
        </Card>
      </>
    );
  }

  if (tab === "liquidez")
    return (
      <>
        <Chips value={acc} onChange={setAcc} options={[{ v: "all", l: "Todas" }, ...debits.map((a) => ({ v: a.id, l: a.name }))]} />
        {acc !== "all" && (
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Saldo {nameOf(acc)}</div>
            <div className="num font-display text-2xl font-bold">{money(rows[0]?.balance ?? 0)}</div>
          </Card>
        )}
        <Card>
          {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sin movimientos</div>}
          {rows.map((r) => (
            <Row
              key={r.id}
              title={r.concept}
              sub={`${fmtDate(r.date)}${multi && acc === "all" ? ` · ${nameOf(debitOf(r, accounts))}` : ""} · Saldo: ${money(r.balance)}`}
              right={<Amount n={Number(r.amount)} />}
              onDelete={() => del("bcp_movements", r.id, r.transfer_id)}
            />
          ))}
        </Card>
      </>
    );

  if (tab === "io") return <CardsView cards={cards} accounts={accounts} io={io} cuotas={cuotas} bcp={bcp} />;

  if (tab === "cuotas")
    return (
      <div className="space-y-3">
        <div className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Deudas externas</div>
        {debts.length === 0 && <div className="py-4 text-center text-sm text-muted-foreground">Sin deudas externas · agrégalas con el +</div>}
        {debts.map((d) => {
          const left = debtRemaining(d, today);
          const next = debtDates(d, today, addMonths(today, 13))[0];
          return (
            <Card key={d.id} className="p-4">
              <div className="flex items-center gap-2">
                <div className="font-display flex-1 font-semibold">{d.name}</div>
                <span className="num font-semibold text-expense">{money(-d.monthly_amount)}</span>
                <button onClick={() => del("debts", d.id)} aria-label="Eliminar" className="text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="num mt-2 space-y-0.5 text-sm text-muted-foreground">
                <div>Día de pago: {d.pay_day} · {left == null ? "sin fecha de fin" : `${left} pago(s) pendiente(s)`}</div>
                <div>Próximo: {next ? fmtDate(next) : "—"}{d.pay_account_id ? ` · desde ${nameOf(d.pay_account_id)}` : ""}</div>
              </div>
            </Card>
          );
        })}
        <div className="px-1 pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cuotas en tarjeta</div>
        {cuotas.length === 0 && <div className="py-4 text-center text-sm text-muted-foreground">Sin cuotas registradas</div>}
        {cuotas.map((c) => {
          const total = c.monthly_amount * c.num_installments;
          const due = installmentDueDates(c, payDayOf(c));
          const on = installmentActive(c, today, payDayOf(c));
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-2">
                <div className="font-display flex-1 font-semibold">{c.concept}</div>
                {cards.length > 1 && <span className="text-xs text-muted-foreground">{nameOf(cardOf(c, accounts))}</span>}
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", on ? "bg-income/15 text-income" : "bg-muted text-muted-foreground")}>
                  {on ? "Activa" : "Terminada"}
                </span>
                <button onClick={() => del("installments", c.id)} aria-label="Eliminar" className="text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="num mt-2 space-y-0.5 text-sm text-muted-foreground">
                <div>Original: {money(c.original_amount)} · {c.num_installments} cuotas de {money(c.monthly_amount)}</div>
                <div>1ra cuota: {fmtDate(due[0] ?? c.first_date)} · Última: {fmtDate(installmentLast(c, payDayOf(c)))}</div>
                <div>Total a pagar: {money(total)} · Interés: {money(total - c.original_amount)}</div>
              </div>
            </Card>
          );
        })}
      </div>
    );

  return (
    <>
      <Card className={cn("p-4", proj.min.balance < 0 ? "border-expense/40 bg-expense/10" : "border-income/30 bg-income/10")}>
        <div className={cn("text-sm font-semibold", proj.min.balance < 0 ? "text-expense" : "text-income")}>
          Saldo mínimo proyectado: <span className="num">{money(proj.min.balance)}</span> el {fmtDate(proj.min.date)}
        </div>
      </Card>
      <Card>
        <Row title="Saldo actual (hoy)" sub={fmtDate(today)} right={<span className="num font-semibold">{money(proj.start)}</span>} />
        {proj.events.map((e, i) => (
          <Row
            key={i}
            title={e.concept}
            sub={fmtDate(e.date)}
            right={
              <div>
                <Amount n={e.amount} />
                <div className={cn("num text-xs", e.balance < 0 ? "text-expense" : "text-muted-foreground")}>{money(e.balance)}</div>
              </div>
            }
          />
        ))}
      </Card>
    </>
  );
}

function CardsView({ cards, accounts, io, cuotas, bcp }: { cards: Account[] } & Pick<Data, "accounts" | "io" | "cuotas" | "bcp">) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const card = cards.find((c) => c.id === cardId) ?? cards[0];
  const mine = useMemo(() => (card ? io.filter((e) => cardOf(e, accounts) === card.id) : []), [io, card, accounts]);
  const payDates = useMemo(() => (card ? [...new Set(mine.map((e) => ioPayDate(e.date, cycle(card))))].sort() : []), [mine, card]);
  const today = todayStr();
  const [selRaw, setSel] = useState("");
  const sel = payDates.includes(selRaw) ? selRaw : (payDates.find((d) => d >= today) ?? payDates[payDates.length - 1] ?? "");
  if (!card) return <div className="py-10 text-center text-muted-foreground">No tienes tarjetas de crédito</div>;
  const pay = sel ? cardPaymentOn(card, sel, accounts, io, cuotas, bcp, today) : null;
  const list = sel ? mine.filter((e) => ioPayDate(e.date, cycle(card)) === sel) : mine;

  return (
    <>
      <Chips value={card.id} onChange={(v) => { setCardId(v); setSel(""); }} options={cards.map((c) => ({ v: c.id, l: c.name }))} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {payDates.map((d) => (
          <button key={d} onClick={() => setSel(d)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", sel === d ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}>
            Pago {fmtDate(d)}
          </button>
        ))}
      </div>
      {pay && (
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{card.name} · total a pagar el {fmtDate(sel)}</div>
          <div className="num font-display text-3xl font-bold text-expense">{money(pay.due)}</div>
          <div className="num text-sm text-muted-foreground">
            Gastos {money(pay.gastos)} · Cuotas {money(pay.cuotas)}
            {pay.paid > 0 && ` · Ya pagado ${money(pay.paid)}`}
          </div>
        </Card>
      )}
      <Card>
        {list.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sin gastos</div>}
        {list.map((e) => (
          <Row
            key={e.id}
            title={e.description}
            sub={`${fmtDate(e.date)} · ${e.category} · paga el ${fmtDate(ioPayDate(e.date, cycle(card)))}`}
            right={<Amount n={-Number(e.amount)} />}
            onDelete={() => del("io_expenses", e.id)}
          />
        ))}
      </Card>
    </>
  );
}
