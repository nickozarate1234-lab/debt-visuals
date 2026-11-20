import { useState } from "react";
import { financeChanged } from "@/hooks/use-finance";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUR_SYMBOL, IO_CATEGORIES, asCur, conv, fmtDate, nextPayDate, todayStr, type Account } from "@/lib/finance";
import { useFx } from "@/hooks/use-fx";
import { cn } from "@/lib/utils";
import { isLimitError, openPaywall } from "@/lib/plans";

export type AddKind = "io" | "bcp" | "traspaso" | "cuota" | "deuda";

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "min-w-0 flex-1 basis-[30%] rounded-lg px-1 py-2 text-sm font-semibold transition",
            value === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function AddDialog({
  open,
  onOpenChange,
  kind,
  setKind,
  userId,
  accounts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: AddKind;
  setKind: (k: AddKind) => void;
  userId: string;
  accounts: Account[];
}) {
  const debits = accounts.filter((a) => a.kind === "debito" && !a.archived);
  const cards = accounts.filter((a) => a.kind === "credito" && !a.archived);
  const [debitId, setDebitId] = useState("");
  const [cardId, setCardId] = useState("");
  const [toId, setToId] = useState("");
  const [payDay, setPayDay] = useState("15");
  const dId = debitId || debits[0]?.id || "";
  const cId = cardId || cards[0]?.id || "";
  const card = cards.find((c) => c.id === cId);
  const destOptions = accounts.filter((a) => !a.archived && a.id !== dId);
  const tId = toId && toId !== dId ? toId : destOptions[0]?.id || "";
  const fromAcc = accounts.find((x) => x.id === dId);
  const destAcc = accounts.find((x) => x.id === tId);
  const sym = CUR_SYMBOL[asCur((kind === "io" || kind === "cuota" ? card : fromAcc)?.currency)];
  const cross = kind === "traspaso" && !!fromAcc && !!destAcc && asCur(fromAcc.currency) !== asCur(destAcc.currency);
  const [amount, setAmount] = useState("");
  // Transfer between currencies: what arrives at the destination (blank = converted with the rate in use).
  const [arrive, setArrive] = useState("");
  const { fx } = useFx();
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(todayStr());
  const [noDate, setNoDate] = useState(false);
  const [cat, setCat] = useState("Comida");
  const [dir, setDir] = useState<"egreso" | "ingreso">("egreso");
  const [n, setN] = useState("3");
  const [monthly, setMonthly] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setAmount("");
    setArrive("");
    setDesc("");
    setMonthly("");
    setDate(todayStr());
    setNoDate(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = Number(amount);
    if ((kind === "io" || kind === "cuota") && !cId) { toast.error("Primero agrega una tarjeta de crédito en Ajustes"); return; }
    if ((kind !== "traspaso" && !desc.trim()) || !Number.isFinite(a) || a === 0) { toast.error("Completa monto y descripción"); return; }
    setBusy(true);
    let error;
    if (kind === "io") {
      ({ error } = await supabase.from("io_expenses").insert({ user_id: userId, account_id: cId || null, date, description: desc.trim().slice(0, 200), category: cat, amount: a }));
    } else if (kind === "bcp") {
      ({ error } = await supabase.from("bcp_movements").insert({
        user_id: userId,
        account_id: dId || null,
        date: noDate ? null : date,
        concept: desc.trim().slice(0, 200),
        amount: dir === "ingreso" ? Math.abs(a) : -Math.abs(a),
      }));
    } else if (kind === "traspaso") {
      const dest = accounts.find((x) => x.id === tId);
      const from = accounts.find((x) => x.id === dId);
      if (!dest || !from) { setBusy(false); toast.error("Elige origen y destino"); return; }
      const v = Math.abs(a);
      const note = desc.trim().slice(0, 150);
      const fromCur = asCur(from.currency);
      const destCur = asCur(dest.currency);
      const got = fromCur === destCur ? v : Math.abs(Number(arrive)) || Math.round(conv(v, fromCur, fx, destCur) * 100) / 100;
      if (dest.kind === "credito") {
        ({ error } = await supabase.from("bcp_movements").insert({
          user_id: userId, account_id: from.id, paid_card_id: dest.id, date,
          concept: note || `Pago tarjeta ${dest.name}`, amount: -v, source: "pago_tarjeta",
          ...(fromCur === destCur ? {} : { card_amount: got }),
        }));
      } else {
        const tid = crypto.randomUUID();
        ({ error } = await supabase.from("bcp_movements").insert([
          { user_id: userId, account_id: from.id, transfer_id: tid, date, concept: note || `Traspaso a ${dest.name}`, amount: -v, source: "traspaso" },
          { user_id: userId, account_id: dest.id, transfer_id: tid, date, concept: note || `Traspaso desde ${from.name}`, amount: got, source: "traspaso" },
        ]));
      }
    } else if (kind === "deuda") {
      const k = n.trim() ? parseInt(n) : null;
      ({ error } = await supabase.from("debts").insert({
        user_id: userId, name: desc.trim().slice(0, 100), monthly_amount: Math.abs(a),
        pay_day: Math.min(31, Math.max(1, Number(payDay) || 15)), start_date: date,
        num_payments: k && k > 0 ? k : null, pay_account_id: dId || null,
      }));
    } else {
      const m = Number(monthly);
      const k = parseInt(n);
      if (!m || !k) {
        setBusy(false);
        toast.error("Completa cuotas y monto mensual");
        return;
      }
      ({ error } = await supabase.from("installments").insert({
        user_id: userId,
        concept: desc.trim().slice(0, 200),
        original_amount: a,
        num_installments: k,
        monthly_amount: m,
        first_date: date,
        account_id: cId || null,
      }));
    }
    setBusy(false);
    if (error) {
      if (isLimitError(error)) { toast.error("Llegaste a tus registros gratis"); openPaywall(); return; }
      toast.error(error.message);
      return;
    }
    toast.success("Registrado");
    financeChanged();
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-border bg-popover">
        <DialogHeader>
          <DialogTitle className="font-display">Nuevo movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Seg
            value={kind}
            onChange={setKind}
            options={[
              { v: "io", l: "Crédito" },
              { v: "bcp", l: "Débito" },
              { v: "traspaso", l: "Traspaso" },
              { v: "cuota", l: "Cuotas" },
              { v: "deuda", l: "Deuda" },
            ]}
          />
          {(kind === "io" || kind === "cuota") && cards.length === 0 && (
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">No tienes tarjetas de crédito. Agrégala en Ajustes (⚙️) con su día de corte y de pago.</p>
          )}
          {(kind === "io" || kind === "cuota") && cards.length > 1 && (
            <Picker label="Tarjeta" value={cId} onChange={setCardId} list={cards} />
          )}
          {(kind === "bcp" || kind === "traspaso" || kind === "deuda") && debits.length > 0 && (kind !== "bcp" || debits.length > 1) && (
            <Picker label={kind === "traspaso" ? "Desde" : kind === "deuda" ? "Se paga desde" : "Cuenta"} value={dId} onChange={setDebitId} list={debits} />
          )}
          {kind === "traspaso" && (
            <Picker label="Hacia (cuenta o tarjeta a pagar)" value={tId} onChange={setToId} list={destOptions} />
          )}
          {kind === "bcp" && (
            <Seg value={dir} onChange={setDir} options={[{ v: "egreso", l: "Egreso" }, { v: "ingreso", l: "Ingreso" }]} />
          )}
          <div className="space-y-1.5">
            <Label>{kind === "cuota" ? `Monto original (${sym})` : kind === "deuda" ? `Cuota mensual (${sym})` : `Monto (${sym})`}</Label>
            <Input inputMode="decimal" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg num" autoFocus />
          </div>
          {cross && fromAcc && destAcc && (
            <div className="space-y-1.5 rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <Label>{destAcc.kind === "credito" ? `Se abona a ${destAcc.name}` : `Llega a ${destAcc.name}`} ({CUR_SYMBOL[asCur(destAcc.currency)]})</Label>
              <Input
                inputMode="decimal"
                type="number"
                step="0.01"
                value={arrive}
                onChange={(e) => setArrive(e.target.value)}
                placeholder={Number(amount) ? (Math.round(conv(Math.abs(Number(amount)), asCur(fromAcc.currency), fx, asCur(destAcc.currency)) * 100) / 100).toFixed(2) : "0.00"}
                className="h-11 num"
              />
              <p className="text-xs text-muted-foreground">Calculado con tu tipo de cambio ({fx.rate.toFixed(4)}). Corrígelo si tu banco usó otro.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{kind === "deuda" ? "Nombre de la deuda" : kind === "traspaso" ? "Nota (opcional)" : "Descripción"}</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} className="h-11" />
          </div>
          {kind === "io" && (
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <div className="flex flex-wrap gap-2">
                {IO_CATEGORIES.map((c) => (
                  <button key={c} type="button" onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1.5 text-sm", cat === c ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {kind === "cuota" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>N° cuotas</Label>
                <Input type="number" value={n} onChange={(e) => setN(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Cuota mensual</Label>
                <Input type="number" step="0.01" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="h-11" />
              </div>
            </div>
          )}
          {kind === "deuda" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Día de pago</Label>
                <Input type="number" value={payDay} onChange={(e) => setPayDay(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>N° pagos (vacío = sin fin)</Label>
                <Input type="number" value={n} onChange={(e) => setN(e.target.value)} className="h-11" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{kind === "cuota" ? "Fecha de la 1ra cuota" : kind === "deuda" ? "Desde (1er pago)" : "Fecha"}</Label>
            <Input type="date" value={date} disabled={noDate} onChange={(e) => setDate(e.target.value)} className="h-11" />
            {kind === "cuota" && card && date && (
              <p className="text-xs text-muted-foreground">
                Se cobra en el pago de {card.name} del <span className="num text-foreground">{fmtDate(nextPayDate(date, card.pay_day))}</span> y luego cada mes.
              </p>
            )}
            {kind === "bcp" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} /> Sin fecha
              </label>
            )}
          </div>
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-base font-bold">
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Picker({ label, value, onChange, list }: { label: string; value: string; onChange: (v: string) => void; list: Account[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {list.map((a) => (
          <button key={a.id} type="button" onClick={() => onChange(a.id)} className={cn("rounded-full border px-3 py-1.5 text-sm", value === a.id ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}>
            {a.name}
            {a.kind === "credito" ? " · tarjeta" : ""}
            {asCur(a.currency) === "USD" ? " · US$" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
