import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const KEY = "install-prompt-dismissed-at";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

function snoozed() {
  try {
    const at = Number(localStorage.getItem(KEY) ?? 0);
    return Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}
function snooze() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage unavailable: the banner just comes back next visit */
  }
}

/** Offers "install as app": the native prompt on Android/Chrome, a two-step guide on iPhone Safari. */
export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const demo = new URLSearchParams(window.location.search).get("demo") === "true";
    if (standalone || demo || snoozed()) return;

    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    // Only Safari can add to the home screen on iOS; skip in-app browsers (Instagram, WhatsApp...) and other iOS browsers.
    const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|WhatsApp|Line\//.test(ua);
    const t = isIOSSafari ? window.setTimeout(() => setMode("ios"), 2500) : undefined;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mode) return null;
  const close = () => {
    snooze();
    setMode(null);
  };
  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "dismissed") snooze();
    setEvt(null);
    setMode(null);
  };

  return (
    <div role="dialog" aria-label="Instalar Mis Finanzas" className="fixed inset-x-3 top-20 z-40 mx-auto max-w-md animate-in fade-in slide-in-from-top-2">
      <div className="glass glass-glow flex items-start gap-3 rounded-3xl p-4">
        <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-bold">Instala Mis Finanzas</div>
          {mode === "android" ? (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">Ábrela desde tu inicio como cualquier app, a pantalla completa.</p>
              <button onClick={install} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow">
                <Download className="size-3.5" /> Instalar app
              </button>
            </>
          ) : (
            <ol className="mt-1.5 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="glass-pill flex size-6 shrink-0 items-center justify-center rounded-full text-primary"><Share className="size-3.5" /></span>
                Toca <b className="text-foreground">Compartir</b> en la barra de Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="glass-pill flex size-6 shrink-0 items-center justify-center rounded-full text-primary"><SquarePlus className="size-3.5" /></span>
                Elige <b className="text-foreground">Agregar a inicio</b>
              </li>
            </ol>
          )}
        </div>
        <button onClick={close} aria-label="Cerrar" className="-m-1 p-1 text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
