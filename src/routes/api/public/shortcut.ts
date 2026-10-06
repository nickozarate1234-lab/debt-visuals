import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(20).max(100),
  tipo: z.enum(["io", "bcp", "IO", "BCP", "iO"]).transform((v) => v.toLowerCase() as "io" | "bcp"),
  monto: z.coerce.number().positive().max(1_000_000),
  descripcion: z.string().trim().min(1).max(200),
  categoria: z.string().trim().max(50).optional(),
  movimiento: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v === "ingreso" ? "ingreso" : "egreso")),
  fecha: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)),
});

const CATS = ["Comida", "Transporte", "Suscripciones", "Entretenimiento", "Salud", "Otros"];

function limaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

export const Route = createFileRoute("/api/public/shortcut")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, mensaje: "JSON inválido" }, { status: 400 });
        }
        const headerToken = request.headers.get("x-token");
        if (headerToken && body && typeof body === "object") (body as Record<string, unknown>)["token"] ??= headerToken;
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false, mensaje: "Datos inválidos", errores: parsed.error.flatten() }, { status: 400 });
        }
        const d = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("shortcut_token", d.token)
          .maybeSingle();
        if (!profile) return Response.json({ ok: false, mensaje: "Token incorrecto" }, { status: 401 });

        const fecha = d.fecha ?? limaToday();
        if (d.tipo === "io") {
          const cat = CATS.find((c) => c.toLowerCase() === (d.categoria ?? "").toLowerCase()) ?? "Otros";
          const { error } = await supabaseAdmin.from("io_expenses").insert({
            user_id: profile.user_id,
            date: fecha,
            description: d.descripcion,
            category: cat,
            amount: d.monto,
            source: "shortcut",
          });
          if (error) return Response.json({ ok: false, mensaje: error.message }, { status: 500 });
          return Response.json({ ok: true, mensaje: `iO: ${d.descripcion} S/ ${d.monto.toFixed(2)} (${cat}) registrado` });
        }
        const amount = d.movimiento === "ingreso" ? d.monto : -d.monto;
        const { error } = await supabaseAdmin.from("bcp_movements").insert({
          user_id: profile.user_id,
          date: fecha,
          concept: d.descripcion,
          amount,
          source: "shortcut",
        });
        if (error) return Response.json({ ok: false, mensaje: error.message }, { status: 500 });
        const { data: rows } = await supabaseAdmin.from("bcp_movements").select("amount").eq("user_id", profile.user_id);
        const saldo = (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);
        return Response.json({
          ok: true,
          mensaje: `BCP ${d.movimiento}: ${d.descripcion} S/ ${d.monto.toFixed(2)}. Saldo: S/ ${saldo.toFixed(2)}`,
        });
      },
    },
  },
});
