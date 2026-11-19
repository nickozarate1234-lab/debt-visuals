import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accountDefaults, accountRefsSchema, accountsGuide, resolveAccount } from "@/lib/ai-accounts";
import type { VoiceParse } from "@/lib/voice.functions";

const CATS = ["Comida", "Transporte", "Suscripciones", "Entretenimiento", "Salud", "Otros"];

export const parseVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ image: z.string().min(20).max(4_000_000), today: z.string().max(10), accounts: accountRefsSchema }).parse(d),
  )
  .handler(async ({ data, context }): Promise<VoiceParse | { error: string }> => {
    const { extractMovement, takeAiQuota } = await import("@/lib/ai.server");
    const over = await takeAiQuota(context.userId);
    if (over) return { error: over };
    try {
      const m = /^data:([^;,]+);base64,(.+)$/s.exec(data.image);
      const [, mimeType, base64] = m ?? [];
      if (!mimeType || !base64) return { error: "Formato de imagen no válido" };
      const p = await extractMovement({
        mimeType,
        base64,
        accountIds: data.accounts.map((a) => a.id),
        prompt: "Extrae el movimiento de este comprobante.",
        instructions: `Lees comprobantes de pago peruanos: boletas/facturas SUNAT, vouchers POS (Niubiz, Izipay), capturas de Yape, Plin, BCP Móvil. Hoy es ${data.today} (Lima).
REGLA CLAVE: en Perú el IGV ya está incluido. IGNORA subtotal, op. gravada e IGV. monto = TOTAL / IMPORTE TOTAL / monto pagado final (incluye propina si aparece en el total). Número positivo en soles.
${accountsGuide(data.accounts, "voucher")}
movimiento: "ingreso" solo si la captura muestra que RECIBIÓ dinero; si no, "egreso". Con tarjeta de crédito siempre "egreso".
descripcion: nombre corto del comercio o destinatario con mayúscula inicial (ej. "Tambo", "Antica Pizzería", "Yape a Juan").
categoria: una de ${CATS.join(", ")} según el comercio.
fecha: YYYY-MM-DD de la fecha del comprobante; cadena vacía si no se ve.
transcript: resumen de una línea de lo que viste (ej. "Boleta Tambo, total S/ 12.50").
Si no es un comprobante o no se lee el total, monto = 0.`,
      });
      if (!(p.monto > 0)) return { error: "No pude leer el total del comprobante" };
      return resolveAccount(p, data.accounts, accountDefaults(data.accounts).credit);
    } catch (e) {
      console.error("parseVoucher", e);
      return { error: "No pude leer la imagen. Intenta otra vez." };
    }
  });
