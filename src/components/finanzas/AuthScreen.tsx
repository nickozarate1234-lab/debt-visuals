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
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password: pass })
        : await supabase.auth.signUp({ email, password: pass, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) {
      const t =
        error.code === "weak_password"
          ? "Esa contraseña es muy común o apareció en filtraciones. Usa una más larga y única."
          : error.code === "invalid_credentials"
            ? "Correo o contraseña incorrectos (o aún no confirmaste tu correo)."
            : error.code === "email_not_confirmed"
              ? "Primero confirma tu correo con el enlace que te enviamos."
              : error.message;
      setMsg({ ok: false, t });
      toast.error(t);
      return;
    }
    if (mode === "up" && !data.session) setMsg({ ok: true, t: "¡Listo! Revisa tu correo y toca el enlace para confirmar tu cuenta." });
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
        {msg && <p className={msg.ok ? "text-sm text-income" : "text-sm text-expense"}>{msg.t}</p>}
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-sm text-muted-foreground">
          {mode === "in" ? "¿Primera vez? Crea tu cuenta" : "Ya tengo cuenta"}
        </button>
      </form>
    </div>
  );
}
