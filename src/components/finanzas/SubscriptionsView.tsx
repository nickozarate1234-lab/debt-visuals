import { useState } from "react";
import { financeChanged } from "@/hooks/use-finance";
import { toast } from "sonner";
import { CalendarClock, Plus, Repeat, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { daysUntil, fmtDate, money, nextCharge, subMonthly, type Account, type Subscription } from "@/lib/finance";
import { cn } from "@/lib/utils";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

export function SubscriptionsView({ subs, accounts, userId }: { subs: Subscription[]; accounts: Account[]; userId: string }) {
  const [open, setOpen] = useState(false);
  const monthly = subs.reduce((s, x) => s + subMonthly(x), 0);
  const upcoming = subs
    .map((s) => ({ s, d: nextCharge(s) }))
    .filter((x): x is { s: Subscription; d: string } => !!x.d)
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  const next = upcoming[0];
  const nameOf = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? accounts.find((a) => a.legacy === "bcp")?.name ?? "BCP";

  const toggle = async (s: Subscription, active: boolean) => {
    const { error } = await supabase.from("subscriptions").update({ active }).eq("id", s.id);
    if (error) toast.error(error.message);
    else financeChanged();
  };
  const remove = async (s: Subscription) => {
    if (!confirm(`¿Eliminar ${s.name}?`)) return;
    const { error } = await supabase.from("subscriptions").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else financeChanged();
  };

  return (
    <>
      <div className="glass glass-glow rounded-3xl p-5">
        <div className="text-xs tracking-wide text-muted-foreground uppercase">Cobros automáticos</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="num font-display text-3xl font-bold">{money(monthly)}</span>
          <span className="text-sm text-muted-foreground">/ mes</span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          <span className="num">{money(monthly * 12)}</span> al año · {subs.filter((s) => s.active).length} activas
        </div>
        {next && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl glass-inset px-4 py-3">
            <CalendarClock className="size-5 text-primary" strokeWidth={1.5} />
            <div className="flex-1 text-sm">
              <span className="font-semibold">{next.s.name}</span> te cobra{" "}
              {daysUntil(next.d) === 0 ? "hoy" : daysUntil(next.d) === 1 ? "mañana" : `en ${daysUntil(next.d)} días`}
            </div>
            <span className="num text-sm font-semibold text-expense">-{money(next.s.amount)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-1 pt-2">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">Mis suscripciones</h2>
        <button onClick={() => setOpen(true)} className="glass-pill flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-primary">
          <Plus className="size-3.5" /> Nueva
        </button>
      </div>

      {subs.length === 0 && (
        <div className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">
          Aún no tienes suscripciones. Agrega Spotify, Netflix, iCloud, gimnasio…
        </div>
      )}
      <div className="grid gap-3">
        {subs.map((s) => {
          const d = nextCharge(s);
          return (
            <div key={s.id} className={cn("glass flex items-center gap-3 rounded-3xl p-4 transition", !s.active && "opacity-50")}>
              <div className="glass-inset flex size-11 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-bold text-primary">
                {s.name.trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  <Repeat className="mr-1 inline size-3" />
                  {s.cycle === "anual" ? `Anual · ${s.charge_day} ${MONTHS[(s.charge_month ?? 1) - 1]}` : `Día ${s.charge_day}`} · {nameOf(s.pay_account_id)}
                  {d && s.active ? ` · ${fmtDate(d)}` : ""}
                </div>
              </div>
              <div className="num text-right font-semibold text-expense">-{money(s.amount)}</div>
              <div className="flex flex-col items-center gap-2">
                <Switch checked={s.active} onCheckedChange={(v) => toggle(s, v)} aria-label="Activa" />
                <button onClick={() => remove(s)} aria-label="Eliminar" className="text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <SubDialog open={open} onOpenChange={setOpen} accounts={accounts} userId={userId} />
    </>
  );
}

function SubDialog({ open, onOpenChange, accounts, userId }: { open: boolean; onOpenChange: (v: boolean) => void; accounts: Account[]; userId: string }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<"mensual" | "anual">("mensual");
  const [day, setDay] = useState("1");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [acc, setAcc] = useState(accounts.find((a) => a.legacy === "bcp")?.id ?? accounts[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const usable = accounts.filter((a) => !a.archived);

  const save = async () => {
    const n = Number(amount.replace(",", "."));
    if (!name.trim() || !(n > 0)) {
      toast.error("Pon nombre y monto");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("subscriptions").insert({
      user_id: userId,
      name: name.trim(),
      amount: n,
      cycle,
      charge_day: Math.min(31, Math.max(1, Number(day) || 1)),
      charge_month: cycle === "anual" ? Number(month) : null,
      pay_account_id: acc || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${name} agregada`);
    financeChanged();
    setName("");
    setAmount("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Nueva suscripción</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spotify" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Monto (S/)</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12.00" />
            </div>
            <div className="grid gap-1.5">
              <Label>Día de cobro</Label>
              <Input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["mensual", "anual"] as const).map((c) => (
              <button key={c} onClick={() => setCycle(c)} className={cn("rounded-xl border py-2 text-sm capitalize", cycle === c ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}>
                {c}
              </button>
            ))}
          </div>
          {cycle === "anual" && (
            <div className="grid gap-1.5">
              <Label>Mes de cobro</Label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border bg-input/30 px-3 text-sm">
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Se cobra en</Label>
            <select value={acc} onChange={(e) => setAcc(e.target.value)} className="h-10 rounded-md border bg-input/30 px-3 text-sm">
              {usable.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.kind === "credito" ? "crédito" : "débito"})</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Si es débito, se descuenta en tu proyección. Si es tarjeta, entra al pago de esa tarjeta cuando registres el cargo.</p>
          </div>
          <Button onClick={save} disabled={saving} className="mt-1 h-11 rounded-xl">Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
