import { createFileRoute } from "@tanstack/react-router";
import { CONTACT_EMAIL, LegalPage } from "@/components/finanzas/LegalPage";

export const Route = createFileRoute("/terminos")({
  head: () => ({ meta: [{ title: "Términos del servicio · Mis Finanzas" }] }),
  component: () => (
    <LegalPage title="Términos del servicio">
      <p>Al usar Mis Finanzas aceptas estos términos.</p>
      <h2>Qué es la app</h2>
      <p>Una herramienta para registrar y ordenar tus finanzas personales. Los cálculos (pagos de tarjeta, cuotas, intereses, línea disponible y proyecciones) son estimaciones basadas en lo que registras y pueden diferir de lo que informe tu banco. Revisa siempre tu estado de cuenta.</p>
      <h2>No es asesoría financiera</h2>
      <p>La información que muestra la app no constituye asesoría financiera, legal ni tributaria.</p>
      <h2>Tu cuenta</h2>
      <p>Eres responsable de la información que registras y de mantener segura tu contraseña. No compartas tu token del atajo de iPhone.</p>
      <h2>Disponibilidad</h2>
      <p>Hacemos lo posible por mantener la app disponible y tus datos seguros, pero el servicio se ofrece "tal cual", sin garantías de disponibilidad continua.</p>
      <h2>Planes de pago</h2>
      <p>Si en el futuro se ofrecen planes de pago, sus condiciones (precio, renovación y cancelación) se mostrarán antes de pagar.</p>
      <h2>Contacto</h2>
      <p>Escríbenos a <a className="text-primary" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  ),
});
