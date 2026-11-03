import { useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IO_CATEGORIES, todayStr } from "@/lib/finance";
import { parseVoice, type VoiceParse } from "@/lib/voice.functions";
import { cn } from "@/lib/utils";

type State = "idle" | "rec" | "busy";

export function VoiceButton({ userId }: { userId: string }) {
  const [state, setState] = useState<State>("idle");
  const [draft, setDraft] = useState<VoiceParse | null>(null);
  const [saving, setSaving] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const parse = useServerFn(parseVoice);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType });
        if (blob.size < 1000) { setState("idle"); toast.error("Grabación muy corta"); return; }
        setState("busy");
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        try {
          const res = await parse({ data: { audio: btoa(bin), mime: r.mimeType, today: todayStr() } });
          if ("error" in res) toast.error(res.error);
          else setDraft(res);
        } catch {
          toast.error("No pude procesar el audio");
        }
        setState("idle");
      };
      rec.current = r;
      r.start();
      setState("rec");
    } catch {
      toast.error("Permite el acceso al micrófono");
    }
  };

  const toggle = () => (state === "rec" ? rec.current?.stop() : state === "idle" ? void start() : undefined);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const fecha = draft.fecha ?? todayStr();
    const { error } =
      draft.cuenta === "io"
        ? await supabase.from("io_expenses").insert({ user_id: userId, date: fecha, description: draft.descripcion.slice(0, 200), category: draft.categoria, amount: draft.monto, source: "voz" })
        : await supabase.from("bcp_movements").insert({ user_id: userId, date: fecha, concept: draft.descripcion.slice(0, 200), amount: draft.movimiento === "ingreso" ? draft.monto : -draft.monto, source: "voz" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Registrado por voz");
    setDraft(null);
  };

  const upd = (p: Partial<VoiceParse>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <>
      <button
        onClick={toggle}
        aria-label={state === "rec" ? "Detener grabación" : "Registrar por voz"}
        className={cn(
          "fixed left-5 bottom-24 z-30 flex size-14 items-center justify-center rounded-full border shadow-glow transition active:scale-95 sm:left-[calc(50%-17rem)]",
          state === "rec" ? "animate-pulse bg-destructive text-destructive-foreground" : "bg-card text-primary",
        )}
      >
        {state === "busy" ? <Loader2 className="size-6 animate-spin" /> : state === "rec" ? <Square className="size-5" /> : <Mic className="size-6" />}
      </button>
      {state === "rec" && (
        <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit rounded-full bg-popover px-4 py-2 text-sm shadow">
          Escuchando… toca ■ al terminar
        </div>
      )}
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
    </>
  );
}
