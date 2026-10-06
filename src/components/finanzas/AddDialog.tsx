import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IO_CATEGORIES, todayStr } from "@/lib/finance";
import { cn } from "@/lib/utils";

export type AddKind = "io" | "bcp" | "cuota";

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="grid gap-1 rounded-xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-lg py-2 text-sm font-semibold transition",
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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: AddKind;
  setKind: (k: AddKind) => void;
  userId: string;
}) {
  const [amount, setAmount] = useState("");
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
    setDesc("");
    setMonthly("");
    setDate(todayStr());
    setNoDate(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = Number(amount);
    if (!desc.trim() || !Number.isFinite(a) || a === 0) { toast.error("Completa monto y descripción"); return; }
    setBusy(true);
    let error;
    if (kind === "io") {
      ({ error } = await supabase.from("io_expenses").insert({ user_id: userId, date, description: desc.trim().slice(0, 200), category: cat, amount: a }));
    } else if (kind === "bcp") {
      ({ error } = await supabase.from("bcp_movements").insert({
        user_id: userId,
        date: noDate ? null : date,
        concept: desc.trim().slice(0, 200),
        amount: dir === "ingreso" ? Math.abs(a) : -Math.abs(a),
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
      }));
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registrado");
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
          <Seg value={kind} onChange={setKind} options={[{ v: "io", l: "Tarjeta iO" }, { v: "bcp", l: "BCP" }, { v: "cuota", l: "Cuotas" }]} />
          {kind === "bcp" && (
            <Seg value={dir} onChange={setDir} options={[{ v: "egreso", l: "Egreso" }, { v: "ingreso", l: "Ingreso" }]} />
          )}
          <div className="space-y-1.5">
            <Label>{kind === "cuota" ? "Monto original" : "Monto (S/)"}</Label>
            <Input inputMode="decimal" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg num" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
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
          <div className="space-y-1.5">
            <Label>{kind === "cuota" ? "Fecha 1ra cuota" : "Fecha"}</Label>
            <Input type="date" value={date} disabled={noDate} onChange={(e) => setDate(e.target.value)} className="h-11" />
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
