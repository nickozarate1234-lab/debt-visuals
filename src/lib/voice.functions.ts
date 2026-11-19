import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accountDefaults, accountRefsSchema, accountsGuide, resolveAccount } from "@/lib/ai-accounts";
import type { Movement } from "@/lib/ai.server";

export type VoiceParse = Movement;

const CATS = ["Comida", "Transporte", "Suscripciones", "Entretenimiento", "Salud", "Otros"];

export const parseVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ audio: z.string().min(10).max(3_000_000), mime: z.string().max(80), today: z.string().max(10), accounts: accountRefsSchema })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<VoiceParse | { error: string }> => {
    const { extractMovement, takeAiQuota } = await import("@/lib/ai.server");
    const over = await takeAiQuota(context.userId);
    if (over) return { error: over };
    try {
      const p = await extractMovement({
        mimeType: data.mime.split(";")[0] || "audio/mp4",
        base64: data.audio,
        accountIds: data.accounts.map((a) => a.id),
        prompt: "Transcribe este audio y extrae el movimiento financiero.",
        instructions: `Recibes un audio corto en español peruano donde alguien registra un gasto o ingreso en soles. Hoy es ${data.today} (Lima).
transcript: transcripción literal del audio. Si no se escucha nada, cadena vacía.
${accountsGuide(data.accounts, "voz")}
movimiento: "ingreso" si recibe/le depositan/le pagan; si no, "egreso". Con tarjeta de crédito siempre "egreso".
monto: número positivo en soles ("lucas" = soles).
descripcion: concepto corto con mayúscula inicial (ej. "Pasaje", "Almuerzo menú").
categoria: una de ${CATS.join(", ")}.
fecha: YYYY-MM-DD si dice "ayer", una fecha, etc.; si no, cadena vacía.
Si no hay monto, monto = 0.`,
      });
      if (!p.transcript) return { error: "No se escuchó nada. Intenta de nuevo." };
      if (!(p.monto > 0)) return { error: `No entendí el monto: "${p.transcript}"` };
      return resolveAccount(p, data.accounts, accountDefaults(data.accounts).debit);
    } catch (e) {
      console.error("parseVoice", e);
      return { error: "No pude procesar el audio. Intenta otra vez." };
    }
  });
