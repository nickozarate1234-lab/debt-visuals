import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VoiceParse } from "@/lib/voice.functions";

const CATS = ["Comida", "Transporte", "Suscripciones", "Entretenimiento", "Salud", "Otros"];

export const parseVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ image: z.string().min(20).max(6_000_000), today: z.string().max(10) }).parse(d),
  )
  .handler(async ({ data }): Promise<VoiceParse | { error: string }> => {
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: `Lees comprobantes de pago peruanos: boletas/facturas SUNAT, vouchers POS (Niubiz, Izipay), capturas de Yape, Plin, BCP Móvil. Hoy es ${data.today} (Lima).
REGLA CLAVE: en Perú el IGV ya está incluido. IGNORA subtotal, op. gravada e IGV. monto = TOTAL / IMPORTE TOTAL / monto pagado final (incluye propina si aparece en el total). Número positivo en soles.
cuenta: "bcp" si es Yape, Plin, transferencia o app BCP; "io" si es voucher de tarjeta/POS o boleta de tienda pagada con tarjeta. Si es dudoso, "io".
movimiento: "ingreso" solo si la captura muestra que RECIBIÓ dinero; si no, "egreso". Para iO siempre "egreso".
descripcion: nombre corto del comercio o destinatario con mayúscula inicial (ej. "Tambo", "Antica Pizzería", "Yape a Juan").
categoria: una de ${CATS.join(", ")} según el comercio.
fecha: YYYY-MM-DD de la fecha del comprobante; null si no se ve.
transcript: resumen de una línea de lo que viste (ej. "Boleta Tambo, total S/ 12.50").
Si no es un comprobante o no se lee el total, monto = 0.`,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Extrae el movimiento de este comprobante." },
              { type: "input_image", image_url: data.image, detail: "high" },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "movimiento",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["transcript", "cuenta", "movimiento", "monto", "descripcion", "categoria", "fecha"],
              properties: {
                transcript: { type: "string" },
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
      } as Parameters<typeof generateResponse>[0]);
      let out = "";
      for (const item of (res as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }).output ?? []) {
        if (item.type === "message") for (const c of item.content ?? []) if (c.type === "output_text") out += c.text ?? "";
      }
      const p = JSON.parse(out) as VoiceParse;
      if (!(p.monto > 0)) return { error: "No pude leer el total del comprobante" };
      if (p.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) p.fecha = null;
      return p;
    } catch (e) {
      console.error("parseVoucher", e);
      return { error: "No pude leer la imagen. Intenta otra vez." };
    }
  });
