import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IO_CATEGORIES, todayStr } from "@/lib/finance";
import type { VoiceParse } from "@/lib/voice.functions";
import { cn } from "@/lib/utils";

export function ConfirmDraft({
  draft,
  setDraft,
  userId,
  source,
  successMsg,
}: {
  draft: VoiceParse | null;
  setDraft: React.Dispatch<React.SetStateAction<VoiceParse | null>>;
  userId: string;
  source: string;
  successMsg: string;
}) {
  const [saving, setSaving] = useState(false);
  const upd = (p: Partial<VoiceParse>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const fecha = draft.fecha ?? todayStr();
    const { error } =
      draft.cuenta === "io"
        ? await supabase.from("io_expenses").insert({ user_id: userId, date: fecha, description: draft.descripcion.slice(0, 200), category: draft.categoria, amount: draft.monto, source })
        : await supabase.from("bcp_movements").insert({ user_id: userId, date: fecha, concept: draft.descripcion.slice(0, 200), amount: draft.movimiento === "ingreso" ? draft.monto : -draft.monto, source });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(successMsg);
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
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(["bcp", "io"] as const).map((c) => (
                <button key={c} onClick={() => upd({ cuenta: c, ...(c === "io" ? { movimiento: "egreso" } : {}) })} className={cn("rounded-lg py-2 text-sm font-semibold", draft.cuenta === c ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {c === "bcp" ? "BCP" : "Tarjeta iO"}
                </button>
              ))}
            </div>
            {draft.cuenta === "bcp" && (
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                {(["egreso", "ingreso"] as const).map((m) => (
                  <button key={m} onClick={() => upd({ movimiento: m })} className={cn("rounded-lg py-2 text-sm font-semibold capitalize", draft.movimiento === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            <Input type="number" step="0.01" value={draft.monto} onChange={(e) => upd({ monto: Number(e.target.value) })} className="h-12 text-lg num" />
            <Input value={draft.descripcion} onChange={(e) => upd({ descripcion: e.target.value })} className="h-11" />
            {draft.cuenta === "io" && (
              <div className="flex flex-wrap gap-2">
                {IO_CATEGORIES.map((c) => (
                  <button key={c} onClick={() => upd({ categoria: c })} className={cn("rounded-full border px-3 py-1.5 text-sm", draft.categoria === c ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <Input type="date" value={draft.fecha ?? todayStr()} onChange={(e) => upd({ fecha: e.target.value })} className="h-11" />
            <Button onClick={save} disabled={saving || !(draft.monto > 0)} className="h-12 w-full rounded-xl text-base font-bold">
              Confirmar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
