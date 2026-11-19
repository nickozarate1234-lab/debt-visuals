import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Google sign-in shows only once the Google provider is configured in Supabase (set VITE_GOOGLE_AUTH=true).
const GOOGLE_AUTH = import.meta.env["VITE_GOOGLE_AUTH"] === "true";

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

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) toast.error("No se pudo entrar con Google. Intenta de nuevo.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="mb-8">
          <div className="mb-4 size-12 rounded-2xl bg-primary shadow-glow" />
          <h1 className="font-display text-3xl font-bold">Mis Finanzas</h1>
          <p className="text-muted-foreground">{mode === "in" ? "Entra a tu cuenta" : "Crea tu cuenta"}</p>
        </div>
        {GOOGLE_AUTH && (<>
        <button
          type="button"
          onClick={google}
          className="flex h-12 w-full items-center justify-center gap-[10px] rounded-xl border border-[#8E918F] bg-[#131314] px-3 text-sm font-medium text-[#E3E3E3]"
        >
          <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          Continuar con Google
        </button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />o con correo<span className="h-px flex-1 bg-border" /></div>
        </>)}
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
