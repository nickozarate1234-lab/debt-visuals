import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Landmark, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { financeChanged } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Account } from "@/lib/finance";
import { cn } from "@/lib/utils";

function AccountRow({ a }: { a: Account }) {
  const [name, setName] = useState(a.name);
  const [cut, setCut] = useState(String(a.cut_day));
  const [pay, setPay] = useState(String(a.pay_day));
  const limit0 = a.credit_limit != null ? String(Number(a.credit_limit)) : "";
  const [limit, setLimit] = useState(limit0);
  const dirty = name !== a.name || cut !== String(a.cut_day) || pay !== String(a.pay_day) || limit !== limit0;
  const save = async () => {
    const { error } = await supabase
      .from("accounts")
      .update({
        name: name.trim() || a.name,
        cut_day: Number(cut) || a.cut_day,
        pay_day: Number(pay) || a.pay_day,
        ...(a.kind === "credito" ? { credit_limit: Number(limit) > 0 ? Number(limit) : null } : {}),
      })
      .eq("id", a.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Guardado");
      financeChanged();
    }
  };
  const toggleArchive = async () => {
    const { error } = await supabase.from("accounts").update({ archived: !a.archived }).eq("id", a.id);
    if (error) toast.error(error.message);
    else financeChanged();
  };
  const Icon = a.kind === "credito" ? CreditCard : Landmark;
  return (
    <div className={cn("space-y-2 rounded-xl bg-muted/50 p-3", a.archived && "opacity-50")}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-9" />
        <span className="shrink-0 text-xs text-muted-foreground">{a.kind === "credito" ? "Crédito" : "Débito"}</span>
      </div>
      {a.kind === "credito" && (
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <label className="space-y-1">Día de corte<Input type="number" value={cut} onChange={(e) => setCut(e.target.value)} className="h-9" /></label>
          <label className="space-y-1">Día de pago<Input type="number" value={pay} onChange={(e) => setPay(e.target.value)} className="h-9" /></label>
          <label className="col-span-2 space-y-1">Línea de crédito (S/)<Input type="number" inputMode="decimal" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Ej. 5000" className="h-9" /></label>
        </div>
      )}
      <div className="flex gap-2">
        {dirty && <Button size="sm" onClick={save} className="rounded-lg">Guardar</Button>}
        {!a.legacy && (
          <Button size="sm" variant="ghost" onClick={toggleArchive} className="text-muted-foreground">
            {a.archived ? "Reactivar" : "Archivar"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function AccountsManager({ userId, accounts }: { userId: string; accounts: Account[] }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"debito" | "credito">("debito");
  const [cut, setCut] = useState("");
  const [pay, setPay] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const day = (v: string) => (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 31 ? Number(v) : null);
  const add = async () => {
    if (!name.trim()) {
      toast.error("Ponle un nombre");
      return;
    }
    const isCard = kind === "credito";
    // Cards need both days: the projection uses them to know when each purchase is paid.
    if (isCard && (!day(cut) || !day(pay))) {
      toast.error("Pon el día de corte y el día de pago (1 a 31)");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("accounts").insert({
      user_id: userId,
      name: name.trim().slice(0, 40),
      kind,
      ...(isCard ? { cut_day: day(cut)!, pay_day: day(pay)!, credit_limit: Number(limit) > 0 ? Number(limit) : null } : {}),
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(isCard ? "Tarjeta creada" : "Cuenta creada");
      setName("");
      setCut("");
      setPay("");
      setLimit("");
      financeChanged();
    }
  };
  return (
    <div className="mx-4 mt-8 space-y-3 rounded-2xl border bg-card p-4">
      <h3 className="font-display font-semibold">Mis cuentas y tarjetas</h3>
      {accounts.map((a) => (
        <AccountRow key={a.id + a.name + a.cut_day + a.pay_day + (a.credit_limit ?? "")} a={a} />
      ))}
      <div className="space-y-2 border-t pt-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["debito", "credito"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-lg py-1.5 text-sm font-semibold", kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {k === "debito" ? "Cuenta (débito)" : "Tarjeta de crédito"}
            </button>
          ))}
        </div>
        <Input placeholder={kind === "credito" ? "Ej. BBVA Visa" : "Ej. BCP ahorros"} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        {kind === "credito" && (
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <label className="space-y-1">Día de corte<Input type="number" inputMode="numeric" min={1} max={31} value={cut} onChange={(e) => setCut(e.target.value)} placeholder="Ej. 25" className="h-9" /></label>
            <label className="space-y-1">Día de pago<Input type="number" inputMode="numeric" min={1} max={31} value={pay} onChange={(e) => setPay(e.target.value)} placeholder="Ej. 12" className="h-9" /></label>
            <label className="col-span-2 space-y-1">Línea de crédito (S/, opcional)<Input type="number" inputMode="decimal" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Ej. 5000" className="h-9" /></label>
            <p className="col-span-2">Están en tu estado de cuenta. Con ellos la app sabe cuándo pagas cada compra.</p>
          </div>
        )}
        <Button onClick={add} disabled={busy} className="w-full rounded-xl">
          <Plus /> {kind === "credito" ? "Agregar tarjeta" : "Agregar cuenta"}
        </Button>
      </div>
    </div>
  );
}
