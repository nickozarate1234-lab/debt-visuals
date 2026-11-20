import { Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CURRENCIES, CUR_LABEL, CUR_SYMBOL, type Cur } from "@/lib/finance";
import { cn } from "@/lib/utils";

/** Two roomy buttons to pick soles or dollars. `size="lg"` is the welcome-step version. */
export function CurrencyPicker({ value, onChange, size = "md" }: { value: Cur; onChange: (c: Cur) => void; size?: "md" | "lg" }) {
  return (
    <div className={cn("grid gap-2", size === "lg" ? "grid-cols-1" : "grid-cols-2")}>
      {CURRENCIES.map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-pressed={on}
            className={cn(
              "flex items-center gap-3 rounded-2xl border text-left transition",
              size === "lg" ? "px-5 py-4" : "justify-center px-3 py-2.5",
              on ? "border-primary bg-primary/10 shadow-glow" : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            <span className={cn("num font-display font-bold", size === "lg" ? "text-xl" : "text-base", on && "text-primary")}>{CUR_SYMBOL[c]}</span>
            <span className={cn(size === "lg" ? "flex-1 text-base" : "text-sm", on && "text-foreground")}>
              {size === "lg" ? (c === "PEN" ? "Soles peruanos" : "Dólares") : CUR_LABEL[c]}
            </span>
            {size === "lg" && <Check className={cn("size-5", on ? "text-primary" : "opacity-0")} />}
          </button>
        );
      })}
    </div>
  );
}

/** Small confirmation pop-up in the app's style. */
export function ConfirmPop({
  open,
  title,
  body,
  action,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="max-w-sm rounded-3xl border-border bg-popover">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
          <AlertDialogAction className="rounded-xl" onClick={onConfirm}>
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
