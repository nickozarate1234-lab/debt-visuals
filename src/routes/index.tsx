import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CreditCard, LineChart, Plus, Receipt, Settings, Trash2, Wallet, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceData, useSession } from "@/hooks/use-finance";
import { AuthScreen } from "@/components/finanzas/AuthScreen";
import { AddDialog, type AddKind } from "@/components/finanzas/AddDialog";
import { SettingsSheet } from "@/components/finanzas/SettingsSheet";
import {
  currentBalance,
  fmtDate,
  installmentActive,
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
      { title: "Mis Finanzas — BCP, iO y proyección" },
      { name: "description", content: "Saldo BCP, gastos con tarjeta iO, cuotas y proyección de saldo en un solo lugar." },
      { property: "og:title", content: "Mis Finanzas" },
      { property: "og:description", content: "Saldo BCP, gastos iO, cuotas y proyección de saldo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Tab = "resumen" | "liquidez" | "io" | "cuotas" | "proyeccion";
const TABS: { id: Tab; l: string; icon: typeof Home }[] = [
  { id: "resumen", l: "Resumen", icon: Home },
  { id: "liquidez", l: "Liquidez", icon: Wallet },
  { id: "io", l: "Gastos iO", icon: CreditCard },
  { id: "cuotas", l: "Cuotas", icon: Receipt },
  { id: "proyeccion", l: "Proyección", icon: LineChart },
];

function Index() {
  const { session, ready } = useSession();
  if (!ready) return <div className="min-h-screen" />;
  if (!session) return <AuthScreen />;
  return <App userId={session.user.id} />;
}

const Amount = ({ n, className }: { n: number; className?: string }) => (
  <span className={cn("num font-semibold", n >= 0 ? "text-income" : "text-expense", className)}>{money(n, true)}</span>
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-2xl border bg-card", className)}>{children}</div>
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

async function del(table: "bcp_movements" | "io_expenses" | "installments", id: string) {
  if (!confirm("¿Eliminar este registro?")) return;
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) toast.error(error.message);
}

function App({ userId }: { userId: string }) {
  const { profile, bcp, io, cuotas, loading, reload } = useFinanceData(true);
  const [tab, setTab] = useState<Tab>("resumen");
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<AddKind>("io");
  const [settings, setSettings] = useState(false);

  const openAdd = () => {
    setAddKind(tab === "liquidez" ? "bcp" : tab === "cuotas" ? "cuota" : "io");
    setAddOpen(true);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/85 px-5 py-4 backdrop-blur">
        <h1 className="font-display text-xl font-bold">Mis Finanzas</h1>
        <button onClick={() => setSettings(true)} aria-label="Info fija" className="rounded-full p-2 hover:bg-muted">
          <Settings className="size-5" />
        </button>
      </header>

      <main className="flex-1 space-y-4 px-4 pt-4 pb-32">
        {loading || !profile ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />
            ))}
          </div>
        ) : (
          <Views tab={tab} profile={profile} bcp={bcp} io={io} cuotas={cuotas} />
        )}
      </main>

      <button
        onClick={openAdd}
        aria-label="Agregar"
        className="fixed right-5 bottom-24 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition active:scale-95 sm:right-[calc(50%-17rem)]"
      >
        <Plus className="size-7" />
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", tab === t.id ? "text-primary" : "text-muted-foreground")}>
              <t.icon className="size-5" />
              {t.l}
            </button>
          ))}
        </div>
      </nav>

      <AddDialog open={addOpen} onOpenChange={setAddOpen} kind={addKind} setKind={setAddKind} userId={userId} />
      {profile && <SettingsSheet open={settings} onOpenChange={setSettings} profile={profile} onSaved={reload} />}
    </div>
  );
}

function Views({ tab, profile, bcp, io, cuotas }: { tab: Tab; profile: Profile } & Pick<ReturnType<typeof useFinanceData>, "bcp" | "io" | "cuotas">) {
  const today = todayStr();
  const proj = useMemo(() => project(profile, bcp, io, cuotas, today), [profile, bcp, io, cuotas, today]);
  const bal = currentBalance(bcp);
  const rows = useMemo(() => withBalances(bcp).reverse(), [bcp]);
  const nextPay = proj.events.find((e) => e.concept.startsWith("Pago iO"));
  const active = cuotas.filter((c) => installmentActive(c, today));

  if (tab === "resumen") {
    const ok = proj.min30.balance >= 0;
    const payBreak = nextPay ? ioPaymentOn(nextPay.date, io, cuotas, profile) : null;
    return (
      <>
        <div className="bg-hero rounded-3xl border p-6">
          <div className="text-sm text-muted-foreground">Saldo BCP actual</div>
          <div className={cn("num font-display mt-1 text-4xl font-bold", bal < 0 && "text-expense")}>{money(bal)}</div>
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
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Próximo pago iO</div>
            <div className="num font-display mt-1 text-xl font-bold text-expense">{payBreak ? money(payBreak.total) : "—"}</div>
            <div className="text-xs text-muted-foreground">{nextPay ? fmtDate(nextPay.date) : ""}</div>
            {payBreak && <div className="mt-1 text-[11px] text-muted-foreground num">Gastos {money(payBreak.gastos)} · Cuotas {money(payBreak.cuotas)}</div>}
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Mínimo en {profile.projection_months} meses</div>
            <div className={cn("num font-display mt-1 text-xl font-bold", proj.min.balance < 0 ? "text-expense" : "text-income")}>{money(proj.min.balance)}</div>
            <div className="text-xs text-muted-foreground">{fmtDate(proj.min.date)}</div>
          </Card>
        </div>
        <Card className="p-4">
          <div className="mb-2 text-xs text-muted-foreground">Cuotas activas</div>
          {active.length ? (
            <div className="flex flex-wrap gap-2">
              {active.map((c) => (
                <span key={c.id} className="rounded-full bg-muted px-3 py-1 text-sm">{c.concept}</span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Ninguna</div>
          )}
        </Card>
        <Card>
          <div className="px-4 pt-4 pb-1 text-xs text-muted-foreground">Últimos movimientos BCP</div>
          {rows.slice(0, 6).map((r) => (
            <Row key={r.id} title={r.concept} sub={fmtDate(r.date)} right={<Amount n={Number(r.amount)} />} />
          ))}
        </Card>
      </>
    );
  }

  if (tab === "liquidez")
    return (
      <Card>
        {rows.map((r) => (
          <Row
            key={r.id}
            title={r.concept}
            sub={`${fmtDate(r.date)} · Saldo: ${money(r.balance)}`}
            right={<Amount n={Number(r.amount)} />}
            onDelete={() => del("bcp_movements", r.id)}
          />
        ))}
      </Card>
    );

  if (tab === "io") return <IoView profile={profile} io={io} cuotas={cuotas} />;

  if (tab === "cuotas")
    return (
      <div className="space-y-3">
        {cuotas.length === 0 && <div className="py-10 text-center text-muted-foreground">Sin cuotas registradas</div>}
        {cuotas.map((c) => {
          const total = c.monthly_amount * c.num_installments;
          const on = installmentActive(c, today);
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-2">
                <div className="font-display flex-1 font-semibold">{c.concept}</div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", on ? "bg-income/15 text-income" : "bg-muted text-muted-foreground")}>
                  {on ? "Activa" : "Terminada"}
                </span>
                <button onClick={() => del("installments", c.id)} aria-label="Eliminar" className="text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="num mt-2 space-y-0.5 text-sm text-muted-foreground">
                <div>Original: {money(c.original_amount)} · {c.num_installments} cuotas de {money(c.monthly_amount)}</div>
                <div>1ra cuota: {fmtDate(c.first_date)} · Última: {fmtDate(installmentLast(c))}</div>
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

function IoView({ profile, io, cuotas }: { profile: Profile } & Pick<ReturnType<typeof useFinanceData>, "io" | "cuotas">) {
  const payDates = useMemo(() => [...new Set(io.map((e) => ioPayDate(e.date, profile)))].sort(), [io, profile]);
  const today = todayStr();
  const [sel, setSel] = useState(() => payDates.find((d) => d >= today) ?? payDates[payDates.length - 1] ?? "");
  const pay = sel ? ioPaymentOn(sel, io, cuotas, profile) : null;
  const list = sel ? io.filter((e) => ioPayDate(e.date, profile) === sel) : io;

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {payDates.map((d) => (
          <button key={d} onClick={() => setSel(d)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", sel === d ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}>
            Pago {fmtDate(d)}
          </button>
        ))}
      </div>
      {pay && (
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total a pagar el {fmtDate(sel)}</div>
          <div className="num font-display text-3xl font-bold text-expense">{money(pay.total)}</div>
          <div className="num text-sm text-muted-foreground">Gastos {money(pay.gastos)} · Cuotas {money(pay.cuotas)}</div>
        </Card>
      )}
      <Card>
        {list.map((e) => (
          <Row
            key={e.id}
            title={e.description}
            sub={`${fmtDate(e.date)} · ${e.category} · paga el ${fmtDate(ioPayDate(e.date, profile))}`}
            right={<Amount n={-Number(e.amount)} />}
            onDelete={() => del("io_expenses", e.id)}
          />
        ))}
      </Card>
    </>
  );
}
