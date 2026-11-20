import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z
  .object({
    token: z.string().min(20).max(100),
    // Original shortcut field: "bcp" (debit) or "io" (credit card). Optional when `cuenta` is sent.
    tipo: z
      .enum(["io", "bcp", "IO", "BCP", "iO"])
      .transform((v) => v.toLowerCase() as "io" | "bcp")
      .optional(),
    // Any account or card by name, e.g. "LATAM Pass". Takes precedence over `tipo`.
    cuenta: z.string().trim().max(60).optional(),
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
  })
  .refine((d) => d.tipo || d.cuenta, { message: "Envía tipo (bcp/io) o cuenta (nombre)", path: ["cuenta"] });

const LIMIT_MSG = "Llegaste a tus 200 registros gratis. Activa Pro en la app para seguir registrando.";

const CATS = ["Comida", "Transporte", "Suscripciones", "Entretenimiento", "Salud", "Otros"];

type Acc = { id: string; name: string; kind: string; legacy: string | null };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Exact name first, then a name that starts with / contains what was sent ("latam" → "LATAM Pass"). */
function findAccount(accounts: Acc[], name: string) {
  const q = norm(name);
  return accounts.find((a) => norm(a.name) === q) ?? accounts.find((a) => norm(a.name).startsWith(q)) ?? accounts.find((a) => norm(a.name).includes(q));
}

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

        const { data: accRows } = await supabaseAdmin
          .from("accounts")
          .select("id, name, kind, legacy")
          .eq("user_id", profile.user_id)
          .eq("archived", false)
          .order("created_at");
        const accounts = (accRows ?? []) as Acc[];

        let acc: Acc | undefined;
        if (d.cuenta) {
          acc = findAccount(accounts, d.cuenta);
          if (!acc) {
            const names = accounts.map((a) => a.name).join(", ");
            return Response.json({ ok: false, mensaje: `No encontré la cuenta "${d.cuenta}". Tus cuentas: ${names}` }, { status: 400 });
          }
        } else {
          const kind = d.tipo === "io" ? "credito" : "debito";
          acc = accounts.find((a) => a.legacy === d.tipo) ?? accounts.find((a) => a.kind === kind);
          if (!acc && kind === "credito") return Response.json({ ok: false, mensaje: "No tienes tarjetas de crédito. Agrega una en Ajustes de la app." }, { status: 400 });
        }

        const fecha = d.fecha ?? limaToday();
        const isCard = acc ? acc.kind === "credito" : d.tipo === "io";
        const label = acc?.name ?? (isCard ? "iO" : "BCP");

        if (isCard) {
          const cat = CATS.find((c) => c.toLowerCase() === (d.categoria ?? "").toLowerCase()) ?? "Otros";
          const { error } = await supabaseAdmin.from("io_expenses").insert({
            user_id: profile.user_id,
            account_id: acc?.id ?? null,
            date: fecha,
            description: d.descripcion,
            category: cat,
            amount: d.monto,
            source: "shortcut",
          });
          if (error) return error.message.includes("LIMITE_GRATIS") ? Response.json({ ok: false, mensaje: LIMIT_MSG }, { status: 402 }) : Response.json({ ok: false, mensaje: error.message }, { status: 500 });
          return Response.json({ ok: true, mensaje: `${label}: ${d.descripcion} S/ ${d.monto.toFixed(2)} (${cat}) registrado` });
        }

        const amount = d.movimiento === "ingreso" ? d.monto : -d.monto;
        const { error } = await supabaseAdmin.from("bcp_movements").insert({
          user_id: profile.user_id,
          account_id: acc?.id ?? null,
          date: fecha,
          concept: d.descripcion,
          amount,
          source: "shortcut",
        });
        if (error) return error.message.includes("LIMITE_GRATIS") ? Response.json({ ok: false, mensaje: LIMIT_MSG }, { status: 402 }) : Response.json({ ok: false, mensaje: error.message }, { status: 500 });
        // Balance of this account (rows without account belong to the original BCP account).
        let q = supabaseAdmin.from("bcp_movements").select("amount").eq("user_id", profile.user_id);
        q = acc ? (acc.legacy === "bcp" ? q.or(`account_id.eq.${acc.id},account_id.is.null`) : q.eq("account_id", acc.id)) : q.is("account_id", null);
        const { data: rows } = await q;
        const saldo = (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);
        return Response.json({
          ok: true,
          mensaje: `${label} ${d.movimiento}: ${d.descripcion} S/ ${d.monto.toFixed(2)}. Saldo: S/ ${saldo.toFixed(2)}`,
        });
      },
    },
  },
});
