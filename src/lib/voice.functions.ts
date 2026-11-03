import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VoiceParse = {
  transcript: string;
  cuenta: "bcp" | "io";
  movimiento: "egreso" | "ingreso";
  monto: number;
  descripcion: string;
  categoria: string;
  fecha: string | null;
};

const CATS = ["Comida", "Transporte", "Suscripciones", "Entretenimiento", "Salud", "Otros"];

export const parseVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ audio: z.string().min(10).max(8_000_000), mime: z.string().max(80), today: z.string().max(10) }).parse(d),
  )
  .handler(async ({ data }): Promise<VoiceParse | { error: string }> => {
    const { transcribeAudio, generateResponse } = await import("@lovable.dev/ai-gateway");
    try {
      const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
      const ext = data.mime.includes("mp4") ? "m4a" : data.mime.includes("ogg") ? "ogg" : "webm";
      const file = new File([bytes], `audio.${ext}`, { type: data.mime.split(";")[0] || "audio/webm" });
      const tr = await transcribeAudio({
        model: "openai/gpt-transcribe",
        file,
        language: "es",
        prompt: "Registro de gastos en soles. BCP, tarjeta iO, egreso, ingreso, pasaje, Yape.",
      });
      const transcript = (typeof tr === "string" ? tr : (tr as { text?: string }).text ?? "").trim();
      if (!transcript) return { error: "No se escuchó nada. Intenta de nuevo." };

      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: `Extrae un movimiento financiero de una frase en español peruano. Hoy es ${data.today} (Lima).
cuenta: "bcp" (cuenta BCP, débito, Yape, efectivo de cuenta) o "io" (tarjeta de crédito iO). Si no se menciona, "bcp".
movimiento: "ingreso" si recibe/le depositan/le pagan; si no, "egreso". Para iO siempre "egreso".
monto: número positivo en soles ("lucas" = soles).
descripcion: concepto corto con mayúscula inicial (ej. "Pasaje", "Almuerzo menú").
categoria: una de ${CATS.join(", ")}.
fecha: YYYY-MM-DD si dice "ayer", una fecha, etc.; si no, null.
Si no hay monto, monto = 0.`,
        input: transcript,
        text: {
          format: {
            type: "json_schema",
            name: "movimiento",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["cuenta", "movimiento", "monto", "descripcion", "categoria", "fecha"],
              properties: {
                cuenta: { type: "string", enum: ["bcp", "io"] },
                movimiento: { type: "string", enum: ["egreso", "ingreso"] },
                monto: { type: "number" },
                descripcion: { type: "string" },
                categoria: { type: "string", enum: CATS },
                fecha: { type: ["string", "null"] },
              },
            },
          },
        },
      });
      let out = "";
      for (const item of (res as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }).output ?? []) {
        if (item.type === "message") for (const c of item.content ?? []) if (c.type === "output_text") out += c.text ?? "";
      }
      const p = JSON.parse(out) as Omit<VoiceParse, "transcript">;
      if (!(p.monto > 0)) return { error: `No entendí el monto: "${transcript}"` };
      if (p.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) p.fecha = null;
      return { ...p, transcript };
    } catch (e) {
      console.error("parseVoice", e);
      return { error: "No pude procesar el audio. Intenta otra vez." };
    }
  });
