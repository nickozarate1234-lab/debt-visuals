import { createFileRoute } from "@tanstack/react-router";

// Mercado Pago notifications: one-time payments, subscription changes and monthly charges.
// Nothing in the notification is trusted: we verify the signature and re-read the object from Mercado Pago.
export const Route = createFileRoute("/api/public/mp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        let body: { type?: string; topic?: string; data?: { id?: string | number } } = {};
        try {
          body = await request.json();
        } catch {
          /* some notifications come only as query params */
        }
        const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
        const dataId = String(url.searchParams.get("data.id") ?? body.data?.id ?? url.searchParams.get("id") ?? "");
        const known = ["payment", "subscription_preapproval", "subscription_authorized_payment"];
        if (!known.includes(type) || !dataId) return new Response(null, { status: 200 }); // acknowledge and ignore

        const mp = await import("@/lib/mercadopago.server");
        if (!mp.validSignature(request.headers, dataId)) return Response.json({ ok: false, mensaje: "Firma inválida" }, { status: 401 });
        try {
          const r =
            type === "payment"
              ? await mp.syncPayment(dataId)
              : type === "subscription_preapproval"
                ? await mp.syncSubscription(dataId)
                : await mp.syncAuthorizedPayment(dataId);
          return Response.json(r);
        } catch (e) {
          console.error("mp-webhook", type, e);
          return Response.json({ ok: false }, { status: 500 }); // Mercado Pago retries
        }
      },
    },
  },
});
