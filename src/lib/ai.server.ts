// Server-only Gemini helper. Load it inside server handlers with a dynamic import:
//   const { extractMovement } = await import("@/lib/ai.server");
import { GoogleGenAI } from "@google/genai";

export const CATS = ["Comida", "Transporte", "Suscripciones", "Entretenimiento", "Salud", "Otros"];

export type Movement = {
  transcript: string;
  /** Account id (one of the ids passed in `accountIds`). */
  cuenta: string;
  movimiento: "egreso" | "ingreso";
  monto: number;
  /** Currency of `monto` as said or printed (the account may be in another one). */
  moneda: "PEN" | "USD";
  descripcion: string;
  categoria: string;
  fecha: string | null;
};

const schema = (accountIds: string[]) => ({
  type: "object",
  properties: {
    transcript: { type: "string" },
    cuenta: { type: "string", enum: accountIds },
    movimiento: { type: "string", enum: ["egreso", "ingreso"] },
    monto: { type: "number" },
    moneda: { type: "string", enum: ["PEN", "USD"] },
    descripcion: { type: "string" },
    categoria: { type: "string", enum: CATS },
    fecha: { type: "string", description: "YYYY-MM-DD o cadena vacía si no se sabe" },
  },
  required: ["transcript", "cuenta", "movimiento", "monto", "moneda", "descripcion", "categoria", "fecha"],
  propertyOrdering: ["transcript", "cuenta", "movimiento", "monto", "moneda", "descripcion", "categoria", "fecha"],
});

// Tried in order; the next one is used when a model is overloaded or unavailable.
// Override with GEMINI_MODEL (comma-separated list allowed).
const DEFAULT_MODELS = "gemini-3.5-flash-lite,gemini-3.1-flash-lite";

let client: GoogleGenAI | null = null;
function ai() {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en las variables de entorno del servidor");
  return (client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: 30_000 } }));
}

const retryable = (e: unknown) => /\b(429|500|503|504)\b|UNAVAILABLE|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED|NOT_FOUND|\b404\b/i.test(String((e as Error)?.message ?? e));

/** Sends one file (audio or image) plus instructions to Gemini and returns the parsed movement. */
export async function extractMovement(opts: { instructions: string; prompt: string; mimeType: string; base64: string; accountIds: string[] }): Promise<Movement> {
  const models = (process.env["GEMINI_MODEL"] || DEFAULT_MODELS).split(",").map((m) => m.trim()).filter(Boolean);
  let res: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>> | undefined;
  let lastErr: unknown;
  for (const model of models) {
    try {
      res = await ai().models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: opts.prompt }, { inlineData: { mimeType: opts.mimeType, data: opts.base64 } }] }],
        config: {
          systemInstruction: opts.instructions,
          responseMimeType: "application/json",
          responseJsonSchema: schema(opts.accountIds),
          temperature: 0,
        },
      });
      break;
    } catch (e) {
      lastErr = e;
      if (!retryable(e)) throw e;
      console.warn(`Gemini ${model} no disponible, probando el siguiente`, String((e as Error)?.message ?? e).slice(0, 160));
    }
  }
  if (!res) throw lastErr;
  const p = JSON.parse(res.text ?? "{}") as Omit<Movement, "fecha"> & { fecha?: string | null };
  const fecha = p.fecha && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) ? p.fecha : null;
  return { ...p, transcript: (p.transcript ?? "").trim(), monto: Number(p.monto) || 0, moneda: p.moneda === "USD" ? "USD" : "PEN", fecha };
}

/** Takes one AI use for this user (daily cap: free 10, Pro 60, plus a global cap). Returns an error message when over. */
export async function takeAiQuota(userId: string): Promise<{ error: string; upsell?: boolean } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("consume_ai", { p_user: userId });
  if (error) {
    console.error("consume_ai", error);
    return { error: "No pude usar la IA ahora. Intenta en un momento." };
  }
  const r = data as { ok: boolean; reason?: string; limit?: number };
  if (r.ok) return null;
  if (r.reason === "global") return { error: "La IA está muy ocupada hoy. Registra a mano y vuelve a intentarlo mañana." };
  // Free users (10/day) are offered Pro (60/day); Pro users just wait until tomorrow.
  return r.limit === 10
    ? { error: "Usaste tus 10 registros con IA de hoy. Con Pro tienes 60 al día.", upsell: true }
    : { error: `Llegaste a tus ${r.limit} usos de IA de hoy. Puedes registrar a mano o volver mañana.` };
}
