import { useState } from "react";
import { financeChanged } from "@/hooks/use-finance";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cuotaRate, cycle, fmtDate, installmentDueDates, ioPayDate, money, type Account, type IoExpense, type Profile } from "@/lib/finance";
import { cn } from "@/lib/utils";

const COMMON = [2, 3, 6, 12, 18, 24, 36];
const pct = (x: number) => `${(x * 100).toLocaleString("es-PE", { maximumFractionDigits: 2 })}%`;

/** Converts a card purchase into cuotas, asking what the bank asks: number of cuotas, cuota amount, amount and first cuota date. */
export function CuotasDialog({ expense, card, onClose }: { expense: IoExpense | null; card: Account; onClose: () => void }) {
  return (
    <Dialog open={!!expense} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-2xl border-border bg-popover">
        <DialogHeader>
          <DialogTitle className="font-display">Pasar a cuotas</DialogTitle>
        </DialogHeader>
        {expense && <Form key={expense.id} expense={expense} card={card} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ expense, card, onClose }: { expense: IoExpense; card: Account; onClose: () => void }) {
  const statement = ioPayDate(expense.date, cycle(card) as Profile);
  const [amount, setAmount] = useState(String(Number(expense.amount)));
  const [n, setN] = useState("3");
  const [cuota, setCuota] = useState("");
  const [first, setFirst] = useState(statement);
  const [busy, setBusy] = useState(false);

  const a = Number(amount);
  const k = Math.floor(Number(n));
  const m = Number(cuota);
  const valid = a > 0 && k >= 1 && k <= 60 && m > 0 && !!first;
  const rate = valid ? cuotaRate(a, m, k) : null;
  const due = valid ? installmentDueDates({ id: "", concept: "", original_amount: a, num_installments: k, monthly_amount: m, first_date: first }, card.pay_day) : [];
  const tooLow = valid && m * k < a - 0.01;

  const save = async () => {
    if (!valid || tooLow) return;
    setBusy(true);
    const { error } = await supabase.rpc("expense_to_installments", { p_expense_id: expense.id, p_num: k, p_monthly: m, p_original: a, p_first_date: first });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${expense.description} pasó a ${k} cuotas de ${money(m)}`);
    financeChanged();
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-muted/60 p-3 text-sm">
        <div className="font-semibold">{expense.description}</div>
        <div className="text-xs text-muted-foreground">
          {fmtDate(expense.date)} · {card.name} · iba en el pago del {fmtDate(statement)}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Monto de la compra (S/)</Label>
        <Input inputMode="decimal" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 num" />
      </div>

      <div className="space-y-1.5">
        <Label>Número de cuotas</Label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON.map((c) => (
            <button key={c} type="button" onClick={() => setN(String(c))} className={cn("rounded-full border px-3 py-1.5 text-sm", String(c) === n ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}>
              {c}
            </button>
          ))}
          <Input type="number" value={n} onChange={(e) => setN(e.target.value)} className="h-9 w-20" aria-label="Otro número de cuotas" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Pago por cuota (S/)</Label>
        <Input inputMode="decimal" type="number" step="0.01" value={cuota} onChange={(e) => setCuota(e.target.value)} placeholder={a > 0 && k > 0 ? `${(a / k).toFixed(2)} si es sin intereses` : ""} className="h-11 num" />
        <p className="text-xs text-muted-foreground">El monto de cada cuota que te muestra el banco.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Fecha de pago de la 1ra cuota</Label>
        <Input type="date" value={first} onChange={(e) => setFirst(e.target.value)} className="h-11" />
        {due[0] && due[0] !== first && <p className="text-xs text-muted-foreground">No es día de pago de {card.name}: se cobrará en el pago del {fmtDate(due[0])}.</p>}
      </div>

      {valid && rate && (
        <div className="space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <Line l="Sale del pago del" r={`${fmtDate(statement)} · −${money(a)}`} />
          <Line l="Total a pagar" r={`${k} × ${money(m)} = ${money(rate.total)}`} />
          <Line l="Intereses" r={rate.interest > 0.005 ? `${money(rate.interest)} (${pct(rate.interest / a)} de la compra)` : "Sin intereses"} strong={rate.interest > 0.005} />
          {rate.tem > 0 && <Line l="Tasa estimada" r={`TEM ${pct(rate.tem)} · TEA ${pct(rate.tea)}`} />}
          <Line l="Cuotas" r={`${fmtDate(due[0] ?? null)} → ${fmtDate(due.at(-1) ?? null)}`} />
          <p className="pt-1 text-xs text-muted-foreground">
            Los {money(a)} pasan a ser crédito usado de tu línea y cada cuota pagada libera su parte de capital.
          </p>
        </div>
      )}
      {tooLow && <p className="text-sm text-expense">Las cuotas suman menos que la compra: revisa el monto por cuota.</p>}

      <Button onClick={save} disabled={busy || !valid || tooLow} className="h-12 w-full rounded-xl text-base font-bold">
        {valid ? `Pasar a ${k} cuota${k === 1 ? "" : "s"}` : "Completa los datos"}
      </Button>
    </div>
  );
}

function Line({ l, r, strong }: { l: string; r: string; strong?: boolean | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{l}</span>
      <span className={cn("num text-right", strong && "font-semibold text-expense")}>{r}</span>
    </div>
  );
}
