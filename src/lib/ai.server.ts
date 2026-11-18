// Server-only Gemini helper. Load it inside server handlers with a dynamic import:
//   const { extractMovement } = await import("@/lib/ai.server");
import { GoogleGenAI } from "@google/genai";

export const CATS = ["Comida", "Transporte", "Suscripciones", "Entretenimiento", "Salud", "Otros"];

export type Movement = {
  transcript: string;
  cuenta: "bcp" | "io";
  movimiento: "egreso" | "ingreso";
  monto: number;
  descripcion: string;
  categoria: string;
  fecha: string | null;
};

const SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string" },
    cuenta: { type: "string", enum: ["bcp", "io"] },
    movimiento: { type: "string", enum: ["egreso", "ingreso"] },
    monto: { type: "number" },
    descripcion: { type: "string" },
    categoria: { type: "string", enum: CATS },
    fecha: { type: "string", description: "YYYY-MM-DD o cadena vacía si no se sabe" },
  },
  required: ["transcript", "cuenta", "movimiento", "monto", "descripcion", "categoria", "fecha"],
  propertyOrdering: ["transcript", "cuenta", "movimiento", "monto", "descripcion", "categoria", "fecha"],
};

let client: GoogleGenAI | null = null;
function ai() {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en las variables de entorno del servidor");
  return (client ??= new GoogleGenAI({ apiKey }));
}

/** Sends one file (audio or image) plus instructions to Gemini and returns the parsed movement. */
export async function extractMovement(opts: { instructions: string; prompt: string; mimeType: string; base64: string }): Promise<Movement> {
  const res = await ai().models.generateContent({
    model: process.env["GEMINI_MODEL"] || "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: opts.prompt }, { inlineData: { mimeType: opts.mimeType, data: opts.base64 } }] }],
    config: {
      systemInstruction: opts.instructions,
      responseMimeType: "application/json",
      responseJsonSchema: SCHEMA,
      temperature: 0,
    },
  });
  const p = JSON.parse(res.text ?? "{}") as Omit<Movement, "fecha"> & { fecha?: string | null };
  const fecha = p.fecha && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) ? p.fecha : null;
  return { ...p, transcript: (p.transcript ?? "").trim(), monto: Number(p.monto) || 0, fecha };
}
