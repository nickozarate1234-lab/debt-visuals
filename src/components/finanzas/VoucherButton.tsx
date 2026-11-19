import { useRef, useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { todayStr, type Account } from "@/lib/finance";
import type { VoiceParse } from "@/lib/voice.functions";
import { parseVoucher } from "@/lib/voucher.functions";
import { ConfirmDraft } from "./ConfirmDraft";
import { openPaywall } from "@/lib/plans";

async function compress(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    const max = 1400;
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function VoucherButton({ userId, accounts }: { userId: string; accounts: Account[] }) {
  const refs = accounts.map(({ id, name, kind, legacy }) => ({ id, name, kind, legacy }));
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<VoiceParse | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const parse = useServerFn(parseVoucher);

  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const image = await compress(f);
      const res = await parse({ data: { image, today: todayStr(), accounts: refs } });
      if ("error" in res) {
            toast.error(res.error);
            if ("upsell" in res && res.upsell) openPaywall();
          }
      else setDraft(res);
    } catch {
      toast.error("No pude leer la imagen");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  return (
    <>
      <button
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Escanear voucher"
        className="flex size-9 items-center justify-center rounded-full border border-primary/30 text-primary transition hover:bg-primary/10 active:scale-95 disabled:opacity-70"
      >
        {busy ? <Loader2 className="size-[18px] animate-spin" strokeWidth={1.5} /> : <ScanLine className="size-[18px]" strokeWidth={1.5} />}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {busy && (
        <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit rounded-full bg-popover px-4 py-2 text-sm shadow">
          Leyendo comprobante…
        </div>
      )}
      <ConfirmDraft draft={draft} setDraft={setDraft} userId={userId} accounts={accounts} source="voucher" successMsg="Voucher registrado" />
    </>
  );
}
