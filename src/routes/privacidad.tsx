import { createFileRoute } from "@tanstack/react-router";
import { CONTACT_EMAIL, LegalPage } from "@/components/finanzas/LegalPage";

export const Route = createFileRoute("/privacidad")({
  head: () => ({ meta: [{ title: "Política de privacidad · Mis Finanzas" }] }),
  component: () => (
    <LegalPage title="Política de privacidad">
      <p>Mis Finanzas es una app para ordenar tus finanzas personales. Esta política explica qué datos guarda, para qué y cómo puedes borrarlos.</p>
      <h2>Qué datos guardamos</h2>
      <ul>
        <li>Tu cuenta: correo electrónico y, si entras con Google, tu nombre y foto de perfil.</li>
        <li>Lo que registras: cuentas, tarjetas, movimientos, gastos, cuotas, deudas, suscripciones y configuración.</li>
      </ul>
      <h2>Para qué los usamos</h2>
      <p>Solo para mostrarte tu información, calcular pagos, cuotas, línea de crédito y la proyección de tu saldo. No vendemos ni compartimos tus datos con fines publicitarios.</p>
      <h2>Voz y comprobantes</h2>
      <p>Cuando registras algo por voz o escaneas un comprobante, el audio o la imagen se envían a Google Gemini solo para extraer el monto, la descripción y la cuenta. No guardamos esos audios ni imágenes. Google procesa ese contenido según sus propios términos.</p>
      <h2>Dónde se guardan</h2>
      <p>Tus datos se almacenan en Supabase (servidores en Estados Unidos) y la app se sirve desde Cloudflare. Cada usuario solo puede ver sus propios datos.</p>
      <h2>Tus derechos</h2>
      <p>Puedes pedir una copia o el borrado de tu cuenta y de todos tus datos escribiendo a <a className="text-primary" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  ),
});
