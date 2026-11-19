import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IO_CATEGORIES, todayStr, type Account } from "@/lib/finance";
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

  const save = async () => {
    if (!draft || !acc) return;
    setSaving(true);
    const fecha = draft.fecha ?? todayStr();
    const { error } = isCard
      ? await supabase.from("io_expenses").insert({ user_id: userId, account_id: acc.id, date: fecha, description: draft.descripcion.slice(0, 200), category: draft.categoria, amount: draft.monto, source })
      : await supabase.from("bcp_movements").insert({ user_id: userId, account_id: acc.id, date: fecha, concept: draft.descripcion.slice(0, 200), amount: draft.movimiento === "ingreso" ? draft.monto : -draft.monto, source });
    setSaving(false);
    if (isLimitError(error)) { toast.error("Llegaste a tus registros gratis"); setDraft(null); openPaywall(); return; }
    if (error) { toast.error(error.message); return; }
    toast.success(`${successMsg} en ${acc.name}`);
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
            <Input type="number" step="0.01" value={draft.monto} onChange={(e) => upd({ monto: Number(e.target.value) })} className="h-12 text-lg num" />
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
