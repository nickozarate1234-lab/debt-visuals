import type { ReactNode } from "react";

/** Contact shown on the public legal pages. */
export const CONTACT_EMAIL = "isave.finza@gmail.com";
export const UPDATED = "18 de noviembre de 2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <a href="/" className="text-sm text-primary">← Mis Finanzas</a>
      <h1 className="font-display mt-4 text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Última actualización: {UPDATED}</p>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/90 [&_h2]:font-display [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  );
}
