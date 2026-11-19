import { createFileRoute } from "@tanstack/react-router";

// Deployment check: which server variables are configured (true/false only, never values).
const NAMES = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY", "MP_ACCESS_TOKEN", "MP_WEBHOOK_SECRET", "APP_URL"];

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, env: Object.fromEntries(NAMES.map((n) => [n, !!process.env[n]])) }),
    },
  },
});
