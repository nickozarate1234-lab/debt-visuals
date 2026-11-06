import { useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { todayStr } from "@/lib/finance";
import { ConfirmDraft } from "./ConfirmDraft";
import { parseVoice, type VoiceParse } from "@/lib/voice.functions";
import { cn } from "@/lib/utils";

type State = "idle" | "rec" | "busy";

export function VoiceButton({ userId }: { userId: string }) {
  const [state, setState] = useState<State>("idle");
  const [draft, setDraft] = useState<VoiceParse | null>(null);
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
      <ConfirmDraft draft={draft} setDraft={setDraft} userId={userId} source="voz" successMsg="Registrado por voz" />
    </>
  );
}
