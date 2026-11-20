import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { financeChanged } from "@/hooks/use-finance";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Account, Cur, Profile } from "@/lib/finance";
import { CurrencyPicker } from "./CurrencyPicker";

/** Shown once, right after a new user signs up: picks the main currency (changeable later in Ajustes). */
export function CurrencyWelcome({ profile, accounts, preview = false }: { profile: Profile; accounts: Account[]; preview?: boolean }) {
  const [cur, setCur] = useState<Cur>("PEN");
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  // `preview`: demo only (?demo=true&bienvenida=1), shows the step without saving anything.
  const open = !closed && (preview || profile.currency_set === false);

  const start = async () => {
    if (preview) return void setClosed(true);
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ currency: cur, currency_set: true, mesada1_currency: cur, mesada2_currency: cur })
      .eq("user_id", profile.user_id);
    // The default account starts in the chosen currency too.
    const base = accounts.find((a) => a.legacy === "bcp");
    if (!error && base) await supabase.from("accounts").update({ currency: cur }).eq("id", base.id);
    setBusy(false);
    if (error) return void toast.error(error.message);
    financeChanged();
  };

  return (
    <Dialog open={open}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} className="max-w-sm rounded-3xl border-border bg-popover p-7 [&>button:last-child]:hidden">
        <DialogHeader className="items-center text-center">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Bienvenido a Mis Finanzas</span>
          <DialogTitle className="font-display pt-3 text-2xl">¿En qué moneda llevas tus cuentas?</DialogTitle>
          <DialogDescription>Será tu moneda principal. Tus totales y tu proyección se mostrarán en ella.</DialogDescription>
        </DialogHeader>
        <div className="pt-2">
          <CurrencyPicker value={cur} onChange={setCur} size="lg" />
        </div>
        <p className="text-center text-xs text-muted-foreground">Puedes cambiarla cuando quieras en Ajustes.</p>
        <Button onClick={start} disabled={busy} className="h-12 w-full rounded-xl text-base font-bold">
          Empezar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
