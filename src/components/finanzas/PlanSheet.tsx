import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cancelMySubscription, confirmReturn, startCheckout } from "@/lib/billing.functions";
import { fmtDate } from "@/lib/finance";
import { ANUAL_PER_MONTH, ANUAL_SAVING, ANUAL_SAVING_PCT, PLANS, openPaywall, type MyPlan, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

const soles = (n: number) => `S/ ${n.toFixed(2)}`;
const PLAN_CHANGED = "plan-changed";

/** Current plan of the signed-in user; refreshes when a payment is confirmed. */
export function usePlan(enabled = true) {
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { data } = await supabase.rpc("my_plan");
    if (data) setPlan(data as unknown as MyPlan);
  }, [enabled]);
  useEffect(() => {
    void load();
    const on = () => void load();
    window.addEventListener(PLAN_CHANGED, on);
    return () => window.removeEventListener(PLAN_CHANGED, on);
  }, [load]);
  return plan;
}
const planChanged = () => window.dispatchEvent(new CustomEvent(PLAN_CHANGED));

/** Small nudge in the summary when the free plan is running out. */
export function PlanBanner({ plan }: { plan: MyPlan | null }) {
  if (!plan || plan.pro) return null;
  const left = Math.max(0, plan.limit - plan.used);
  if (left > 30) return null;
  return (
    <button onClick={openPaywall} className="glass flex w-full items-center gap-3 rounded-3xl p-4 text-left">
      <Sparkles className="size-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        <div className="font-semibold">{left === 0 ? "Llegaste a tus registros gratis" : `Te quedan ${left} registros gratis`}</div>
        <div className="text-muted-foreground">Pro desde {soles(ANUAL_PER_MONTH)} al mes</div>
      </div>
      <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Ver planes</span>
    </button>
  );
}

/** Plans sheet: opens from Settings, the banner, or when an insert hits the free limit. Also handles the return from Mercado Pago. */
export function PlanSheet({ plan }: { plan: MyPlan | null }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<PlanId>("anual");
  const [busy, setBusy] = useState(false);
  const checkout = useServerFn(startCheckout);
  const confirm = useServerFn(confirmReturn);
  const cancel = useServerFn(cancelMySubscription);

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("open-paywall", on);
    return () => window.removeEventListener("open-paywall", on);
  }, []);

  // Back from Mercado Pago: ?pago=ok&payment_id=… or ?suscripcion=ok&preapproval_id=…
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const paymentId = q.get("payment_id") ?? q.get("collection_id") ?? undefined;
    const preapprovalId = q.get("preapproval_id") ?? undefined;
    if (!q.has("pago") && !q.has("suscripcion")) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (q.get("pago") === "error") return void toast.error("El pago no se completó. Puedes intentarlo de nuevo.");
    if (!paymentId && !preapprovalId) return;
    void confirm({ data: { ...(paymentId ? { paymentId } : {}), ...(preapprovalId ? { preapprovalId } : {}) } }).then((r) => {
      if ("error" in r) toast.error(r.error);
      else if (r.pro) toast.success("¡Listo! Ya eres Pro 🎉");
      else toast.message("Recibimos tu pago. Se activará apenas Mercado Pago lo confirme.");
      planChanged();
    });
  }, [confirm]);

  const pay = async () => {
    setBusy(true);
    const r = await checkout({ data: { plan: choice } });
    if ("error" in r) {
      setBusy(false);
      toast.error(r.error);
      return;
    }
    window.location.href = r.url;
  };

  const cancelSub = async () => {
    if (!plan?.subscription) return;
    setBusy(true);
    const r = await cancel({ data: { id: plan.subscription.id } });
    setBusy(false);
    if ("error" in r) toast.error(r.error);
    else toast.success(`Suscripción cancelada. Sigues con Pro hasta el ${fmtDate(plan.pro_until?.slice(0, 10) ?? null)}.`);
    planChanged();
  };

  const full = !!plan && !plan.pro && plan.used >= plan.limit;
  const subActive = plan?.subscription?.status === "authorized";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-2xl border-border bg-popover">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Crown className="size-5 text-primary" /> {full ? "Llegaste a tus registros gratis" : "Mis Finanzas Pro"}
          </DialogTitle>
        </DialogHeader>

        {plan?.pro ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div className="font-semibold text-primary">{plan.lifetime ? "Pro de por vida" : `Pro hasta el ${fmtDate(plan.pro_until?.slice(0, 10) ?? null)}`}</div>
              <div className="text-muted-foreground">Registros ilimitados · {plan.used} registrados</div>
            </div>
            {subActive && (
              <Button variant="ghost" disabled={busy} onClick={cancelSub} className="w-full text-muted-foreground">
                Cancelar suscripción mensual
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {plan && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Plan gratis</span>
                  <span className="num">{Math.min(plan.used, plan.limit)} / {plan.limit} registros</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", full ? "bg-expense" : "bg-primary")} style={{ width: `${Math.min(100, (plan.used / plan.limit) * 100)}%` }} />
                </div>
              </div>
            )}

            <ul className="space-y-1.5 text-sm">
              {["Registros ilimitados: a mano, por voz, con el escáner o el atajo de iPhone", "Tarjetas, cuotas y línea de crédito sin tope", "Proyección de tu saldo a 6 meses"].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <PlanOption
                selected={choice === "anual"}
                onClick={() => setChoice("anual")}
                badge={`Ahorras ${ANUAL_SAVING_PCT}%`}
                price={soles(ANUAL_PER_MONTH)}
                per="/ mes"
                title="Anual"
                sub={`Un solo pago de ${soles(PLANS.anual.price)} · Yape o tarjeta · ahorras ${soles(ANUAL_SAVING)}`}
              />
              <PlanOption
                selected={choice === "mensual"}
                onClick={() => setChoice("mensual")}
                price={soles(PLANS.mensual.price)}
                per="/ mes"
                title="Mensual"
                sub="Se cobra solo cada mes con tarjeta · cancela cuando quieras"
              />
            </div>

            <Button onClick={pay} disabled={busy} className="h-12 w-full rounded-xl text-base font-bold">
              {busy ? <Loader2 className="size-5 animate-spin" /> : choice === "anual" ? `Pagar ${soles(PLANS.anual.price)} con Mercado Pago` : `Suscribirme por ${soles(PLANS.mensual.price)}/mes`}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Pago seguro con Mercado Pago. Al continuar aceptas los <a href="/terminos" className="underline">términos</a>.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanOption(props: { selected: boolean; onClick: () => void; badge?: string; price: string; per: string; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn("relative w-full rounded-2xl border p-4 text-left transition", props.selected ? "border-primary bg-primary/10 shadow-glow" : "border-border")}
    >
      {props.badge && <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">{props.badge}</span>}
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{props.title}</span>
        <span>
          <span className="num font-display text-xl font-bold">{props.price}</span>
          <span className="text-xs text-muted-foreground"> {props.per}</span>
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{props.sub}</div>
    </button>
  );
}
