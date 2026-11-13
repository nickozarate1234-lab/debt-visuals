import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account, Profile } from "@/lib/finance";
import { AccountsManager } from "./AccountsManager";

const FIELDS: { k: keyof Profile; l: string; type?: string }[] = [
  { k: "mesada1_day", l: "Mesada 1 · día" },
  { k: "mesada1_amount", l: "Mesada 1 · monto" },
  { k: "mesada2_day", l: "Mesada 2 · día" },
  { k: "mesada2_amount", l: "Mesada 2 · monto" },
  { k: "projection_months", l: "Meses a proyectar" },
];

export function SettingsSheet({ open, onOpenChange, profile, accounts, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; profile: Profile; accounts: Account[]; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    setForm(Object.fromEntries(FIELDS.map((f) => [f.k, String(profile[f.k] ?? "")])));
  }, [profile]);

  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/public/shortcut` : "";

  const save = async () => {
    const patch: Record<string, string | number | null> = {};
    for (const f of FIELDS) patch[f.k] = f.type === "date" ? form[f.k] || null : Number(form[f.k]) || 0;
    const { error } = await supabase.from("profiles").update(patch as never).eq("user_id", profile.user_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Guardado");
    onSaved();
  };
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copiado"));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-border bg-background sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Info fija</SheetTitle>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-2 gap-3 px-4">
          {FIELDS.map((f) => (
            <div key={f.k} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{f.l}</Label>
              <Input type={f.type ?? "number"} step="0.01" value={form[f.k] ?? ""} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
            </div>
          ))}
          <Button onClick={save} className="col-span-2 mt-2 rounded-xl">Guardar cambios</Button>
        </div>

        <AccountsManager userId={profile.user_id} accounts={accounts} />

        <div className="mx-4 mt-8 space-y-3 rounded-2xl border bg-card p-4">
          <h3 className="font-display font-semibold">Atajo de iPhone</h3>
          <p className="text-sm text-muted-foreground">Usa estos datos en la acción “Obtener contenido de URL” (método POST, cuerpo JSON).</p>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">URL</Label>
            <button onClick={() => copy(endpoint)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-left text-xs break-all">
              {endpoint} <Copy className="size-4 shrink-0" />
            </button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">token (secreto, no lo compartas)</Label>
            <button onClick={() => copy(profile.shortcut_token)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-left font-mono text-xs break-all">
              {profile.shortcut_token} <Copy className="size-4 shrink-0" />
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">{`{
  "token": "…",
  "tipo": "io" | "bcp",
  "monto": 12.5,
  "descripcion": "Almuerzo",
  "categoria": "Comida",        // si es io
  "movimiento": "egreso",       // si es bcp: ingreso/egreso
  "fecha": "2026-10-05"         // opcional, hoy por defecto
}`}</pre>
        </div>

        <div className="p-4">
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => supabase.auth.signOut()}>
            <LogOut /> Cerrar sesión
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
