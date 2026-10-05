import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password: pass })
        : await supabase.auth.signUp({ email, password: pass, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (mode === "up" && !data.session) toast.success("Revisa tu correo para confirmar la cuenta");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="mb-8">
          <div className="mb-4 size-12 rounded-2xl bg-primary shadow-glow" />
          <h1 className="font-display text-3xl font-bold">Mis Finanzas</h1>
          <p className="text-muted-foreground">{mode === "in" ? "Entra a tu cuenta" : "Crea tu cuenta"}</p>
        </div>
        <Input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" required />
        <Input type="password" placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} className="h-12" minLength={6} required />
        <Button disabled={busy} className="h-12 w-full rounded-xl font-bold">
          {mode === "in" ? "Entrar" : "Crear cuenta"}
        </Button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-sm text-muted-foreground">
          {mode === "in" ? "¿Primera vez? Crea tu cuenta" : "Ya tengo cuenta"}
        </button>
      </form>
    </div>
  );
}
