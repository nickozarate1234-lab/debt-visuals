import { useState } from "react";
import { financeChanged } from "@/hooks/use-finance";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CUR_SYMBOL, CURRENCIES, IO_CATEGORIES, asCur, conv, money, todayStr, type Account } from "@/lib/finance";
import { useFx } from "@/hooks/use-fx";
import type { VoiceParse } from "@/lib/voice.functions";
import { cn } from "@/lib/utils";
import { isLimitError, openPaywall } from "@/lib/plans";

export function ConfirmDraft({
  draft,
  setDraft,
  userId,
  accounts,
  source,
  successMsg,
}: {
  draft: VoiceParse | null;
  setDraft: React.Dispatch<React.SetStateAction<VoiceParse | null>>;
  userId: string;
  /** Active (non-archived) accounts the movement can go to. */
  accounts: Account[];
  source: string;
  successMsg: string;
}) {
  const [saving, setSaving] = useState(false);
  const upd = (p: Partial<VoiceParse>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const acc = accounts.find((a) => a.id === draft?.cuenta);
  const isCard = acc?.kind === "credito";
  const { fx } = useFx();
  // Said or printed in one currency, saved in the account's: converted with the rate in use.
  const accCurr = asCur(acc?.currency);
  const said = asCur(draft?.moneda);
  const amount = draft ? (said === accCurr ? draft.monto : Math.round(conv(draft.monto, said, fx, accCurr) * 100) / 100) : 0;

  const save = async () => {
    if (!draft || !acc) return;
    setSaving(true);
    const fecha = draft.fecha ?? todayStr();
    const { error } = isCard
      ? await supabase.from("io_expenses").insert({ user_id: userId, account_id: acc.id, date: fecha, description: draft.descripcion.slice(0, 200), category: draft.categoria, amount, source })
      : await supabase.from("bcp_movements").insert({ user_id: userId, account_id: acc.id, date: fecha, concept: draft.descripcion.slice(0, 200), amount: draft.movimiento === "ingreso" ? amount : -amount, source });
    setSaving(false);
    if (isLimitError(error)) { toast.error("Llegaste a tus registros gratis"); setDraft(null); openPaywall(); return; }
    if (error) { toast.error(error.message); return; }
    toast.success(`${successMsg} en ${acc.name}`);
    financeChanged();
    setDraft(null);
  };

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
      <DialogContent className="max-w-md rounded-2xl border-border bg-popover">
        <DialogHeader>
          <DialogTitle className="font-display">¿Registrar esto?</DialogTitle>
        </DialogHeader>
        {draft && (
          <div className="space-y-4">
            <p className="text-sm italic text-muted-foreground">“{draft.transcript}”</p>
            <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => upd({ cuenta: a.id, ...(a.kind === "credito" ? { movimiento: "egreso" } : {}) })}
                  className={cn("min-w-0 flex-1 basis-[30%] rounded-lg px-2 py-2 text-sm font-semibold", draft.cuenta === a.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  {a.name}
                  {a.kind === "credito" && <span className="block text-[10px] font-medium opacity-70">tarjeta</span>}
                </button>
              ))}
            </div>
            {!isCard && (
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                {(["egreso", "ingreso"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => upd({ movimiento: m })} className={cn("rounded-lg py-2 text-sm font-semibold capitalize", draft.movimiento === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                {CURRENCIES.map((c) => (
                  <button key={c} type="button" onClick={() => upd({ moneda: c })} className={cn("num rounded-lg px-2.5 text-sm font-semibold", said === c ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                    {CUR_SYMBOL[c]}
                  </button>
                ))}
              </div>
              <Input type="number" step="0.01" value={draft.monto} onChange={(e) => upd({ monto: Number(e.target.value) })} className="h-12 text-lg num" />
            </div>
            {acc && said !== accCurr && draft.monto > 0 && (
              <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                {acc.name} está en {CUR_SYMBOL[accCurr]}: se registrará como <span className="num font-semibold text-foreground">{money(amount, false, accCurr)}</span> (TC {fx.rate.toFixed(4)}).
              </p>
            )}
            <Input value={draft.descripcion} onChange={(e) => upd({ descripcion: e.target.value })} className="h-11" />
            {isCard && (
              <div className="flex flex-wrap gap-2">
                {IO_CATEGORIES.map((c) => (
                  <button key={c} type="button" onClick={() => upd({ categoria: c })} className={cn("rounded-full border px-3 py-1.5 text-sm", draft.categoria === c ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <Input type="date" value={draft.fecha ?? todayStr()} onChange={(e) => upd({ fecha: e.target.value })} className="h-11" />
            <Button onClick={save} disabled={saving || !acc || !(draft.monto > 0)} className="h-12 w-full rounded-xl text-base font-bold">
              Confirmar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
