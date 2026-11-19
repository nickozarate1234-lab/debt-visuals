# Mis Finanzas

PWA de finanzas personales: cuentas de débito, tarjetas de crédito (cortes, pagos, cuotas y línea disponible), deudas, suscripciones y una proyección del saldo a 6 meses. Los movimientos se registran a mano, por voz, escaneando un voucher o desde un atajo de iPhone.

**En producción:** https://misfinanzasperu.pages.dev · **Demo sin login:** https://misfinanzasperu.pages.dev/?demo=true

## Stack

- TanStack Start (React 19 + Vite + Nitro), desplegado en Cloudflare Pages
- Supabase: Postgres con RLS por usuario y Auth (correo; Google opcional)
- Gemini para leer audios y comprobantes (`src/lib/ai.server.ts`)

## Desarrollo local

```sh
npm install
cp .env.example .env.local   # y completa los valores
npm run dev                  # http://localhost:8080
npm test
```

Variables (ver `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` y, solo en local, `SUPABASE_DB_URL` para migraciones. Las mismas (menos `SUPABASE_DB_URL`) van en Cloudflare → tu proyecto de Pages → Settings → Variables and Secrets, más `APP_URL` y `MP_WEBHOOK_SECRET`.

## Base de datos

Las migraciones están en `drizzle/migrations/`. Para aplicarlas:

```sh
node node_modules/drizzle-kit/bin.cjs migrate
```

## Atajo de iPhone

`POST /api/public/shortcut` con JSON:

| Campo | Obligatorio | Ejemplo |
|---|---|---|
| `token` | sí | el de Ajustes en la app |
| `monto` | sí | `12.5` |
| `descripcion` | sí | `"Almuerzo"` |
| `cuenta` | o `tipo` | `"LATAM Pass"` (nombre de cualquier cuenta o tarjeta) |
| `tipo` | o `cuenta` | `"bcp"` (débito) o `"io"` (tarjeta) |
| `movimiento` | no | `"egreso"` (por defecto) o `"ingreso"` |
| `categoria` | no | `"Comida"` (solo tarjetas) |
| `fecha` | no | `"2026-11-18"` |
