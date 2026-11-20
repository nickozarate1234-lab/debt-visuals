import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUR_LABEL, CUR_SYMBOL, asCur, fmtDate, type Account, type Cur, type Profile } from "@/lib/finance";
import { useFx } from "@/hooks/use-fx";
import { cn } from "@/lib/utils";
import { AccountsManager } from "./AccountsManager";
import { ConfirmPop, CurrencyPicker } from "./CurrencyPicker";
import { openPaywall } from "@/lib/plans";

type Form = { d1: string; a1: string; c1: Cur; d2: string; a2: string; c2: Cur; months: string };
const toForm = (p: Profile): Form => ({
  d1: String(p.mesada1_day),
  a1: String(p.mesada1_amount),
  c1: asCur(p.mesada1_currency),
  d2: String(p.mesada2_day),
  a2: String(p.mesada2_amount),
  c2: asCur(p.mesada2_currency),
  months: String(p.projection_months),
});

const Section = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("mx-4 mt-6 space-y-4 rounded-3xl border bg-card p-5", className)}>
    <h3 className="font-display font-semibold">{title}</h3>
    {children}
  </div>
);

export function SettingsSheet({ open, onOpenChange, profile, accounts, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; profile: Profile; accounts: Account[]; onSaved: () => void }) {
  const { auto } = useFx();
  const main = asCur(profile.currency);
  const [form, setForm] = useState<Form>(toForm(profile));
  const [askMain, setAskMain] = useState<Cur | null>(null);
  const [ownRate, setOwnRate] = useState(profile.usd_rate ? String(profile.usd_rate) : "");
  const [rateMode, setRateMode] = useState<"auto" | "own">(profile.usd_rate ? "own" : "auto");
  useEffect(() => {
    setForm(toForm(profile));
    setOwnRate(profile.usd_rate ? String(profile.usd_rate) : "");
    setRateMode(profile.usd_rate ? "own" : "auto");
  }, [profile]);

  const update = async (patch: Partial<Profile>, ok = "Guardado") => {
    const { error } = await supabase.from("profiles").update(patch as never).eq("user_id", profile.user_id);
    if (error) return void toast.error(error.message);
    toast.success(ok);
    onSaved();
  };

  const saveIncome = () => {
    const day = (v: string, d: number) => Math.min(31, Math.max(1, Number(v) || d));
    void update({
      mesada1_day: day(form.d1, 1),
      mesada1_amount: Number(form.a1) || 0,
      mesada1_currency: form.c1,
      mesada2_day: day(form.d2, 15),
      mesada2_amount: Number(form.a2) || 0,
      mesada2_currency: form.c2,
      projection_months: Math.min(24, Math.max(1, Number(form.months) || 6)),
    });
  };

  const saveRate = (mode: "auto" | "own") => {
    if (mode === "auto") return void update({ usd_rate: null }, "Usando el tipo de cambio de hoy");
    const r = Number(ownRate.replace(",", "."));
    if (!(r > 0.5 && r < 50)) return void toast.error("Pon un tipo de cambio válido, por ejemplo 3.50");
    void update({ usd_rate: r }, `Usando tu tipo de cambio: ${r}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-border bg-background pb-10 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Ajustes</SheetTitle>
        </SheetHeader>

        <button onClick={openPaywall} className="mx-4 mt-2 flex w-[calc(100%-2rem)] items-center justify-between rounded-3xl border border-primary/30 bg-primary/10 p-5 text-left">
          <span className="font-display font-semibold">Mi plan</span>
          <span className="text-sm text-primary">Ver planes y estado →</span>
        </button>

        <Section title="Moneda principal">
          <p className="text-sm text-muted-foreground">Tus totales, tu proyección y el semáforo se muestran en {CUR_LABEL[main].toLowerCase()}.</p>
          <CurrencyPicker value={main} onChange={(c) => c !== main && setAskMain(c)} />
        </Section>

        <Section title="Tipo de cambio">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">US$ 1 =</span>
            <span className="num font-display text-2xl font-bold">
              S/ {(rateMode === "own" && Number(profile.usd_rate) > 0 ? Number(profile.usd_rate) : auto.rate).toFixed(4)}
            </span>
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => {
                setRateMode("auto");
                if (profile.usd_rate) saveRate("auto");
              }}
              className={cn("flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm", rateMode === "auto" ? "border-primary bg-primary/10" : "border-border text-muted-foreground")}
            >
              <span>
                Automático <span className="text-muted-foreground">· {auto.approx ? "aproximado" : auto.fetchedAt ? `actualizado ${fmtDate(auto.fetchedAt.slice(0, 10))}` : "hoy"}</span>
              </span>
              <span className="num font-semibold">{auto.rate.toFixed(4)}</span>
            </button>
            <button
              type="button"
              onClick={() => setRateMode("own")}
              className={cn("rounded-2xl border px-4 py-3 text-left text-sm", rateMode === "own" ? "border-primary bg-primary/10" : "border-border text-muted-foreground")}
            >
              Usar el mío <span className="text-muted-foreground">· por ejemplo, el de tu banco</span>
            </button>
            {rateMode === "own" && (
              <div className="flex gap-2">
                <Input inputMode="decimal" value={ownRate} onChange={(e) => setOwnRate(e.target.value)} placeholder="3.50" className="h-11 num" />
                <Button onClick={() => saveRate("own")} className="h-11 rounded-xl">Guardar</Button>
              </div>
            )}
          </div>
          {auto.source && <p className="text-xs text-muted-foreground">Tipo de cambio automático: {auto.source === "BCRP" ? "BCRP (SBS venta)" : <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="underline">ExchangeRate-API</a>}.</p>}
        </Section>

        <Section title="Ingresos y proyección">
          {([1, 2] as const).map((n) => {
            const d = n === 1 ? "d1" : "d2";
            const a = n === 1 ? "a1" : "a2";
            const c = n === 1 ? "c1" : "c2";
            return (
              <div key={n} className="space-y-2">
                <div className="text-sm font-medium">Sueldo {n}</div>
                <div className="grid grid-cols-[5rem_1fr] gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Día</Label>
                    <Input type="number" value={form[d]} onChange={(e) => setForm({ ...form, [d]: e.target.value })} className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Monto ({CUR_SYMBOL[form[c]]})</Label>
                    <Input type="number" step="0.01" value={form[a]} onChange={(e) => setForm({ ...form, [a]: e.target.value })} className="h-10 num" />
                  </div>
                </div>
                <CurrencyPicker value={form[c]} onChange={(v) => setForm({ ...form, [c]: v })} />
              </div>
            );
          })}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Meses a proyectar</Label>
            <Input type="number" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} className="h-10" />
          </div>
          <Button onClick={saveIncome} className="h-11 w-full rounded-xl">Guardar cambios</Button>
        </Section>

        <AccountsManager userId={profile.user_id} accounts={accounts} mainCur={main} />

        <Section title="Atajo de iPhone" className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none select-none space-y-2 blur-[5px]">
            <p className="text-sm text-muted-foreground">Registra gastos desde Siri o tu pantalla de inicio.</p>
            <div className="rounded-lg bg-muted px-3 py-2 font-mono text-xs">{profile.shortcut_token.slice(0, 24)}…</div>
            <div className="rounded-lg bg-muted px-3 py-2 text-xs">POST /api/public/shortcut</div>
          </div>
          <div className="absolute inset-0 top-10 flex items-center justify-center">
            <span className="rounded-full border border-primary/40 bg-background/70 px-5 py-2 text-xs font-bold tracking-[0.25em] text-primary">PRÓXIMAMENTE</span>
          </div>
        </Section>

        <div className="p-4">
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => supabase.auth.signOut()}>
            <LogOut /> Cerrar sesión
          </Button>
        </div>

        <ConfirmPop
          open={askMain != null}
          title={`¿Cambiar tu moneda principal a ${askMain ? CUR_LABEL[askMain].toLowerCase() : ""}?`}
          body={`Todos tus totales, tu proyección y el semáforo se recalcularán en ${askMain ? CUR_SYMBOL[askMain] : ""} con el tipo de cambio. Tus registros no cambian.`}
          action="Sí, recalcular"
          onConfirm={() => {
            const c = askMain;
            setAskMain(null);
            if (c) void update({ currency: c }, `Moneda principal: ${CUR_LABEL[c].toLowerCase()}`);
          }}
          onCancel={() => setAskMain(null)}
        />
      </SheetContent>
    </Sheet>
  );
}
