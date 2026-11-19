import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Deploy target: Cloudflare Pages when built there (CF_PAGES is set by Cloudflare),
// otherwise Nitro auto-detects (plain Node server locally). Override with NITRO_PRESET.
// Cloudflare Workers Builds sets WORKERS_CI; Pages sets CF_PAGES. Workers: generate the wrangler config
// so the dashboard's `npx wrangler deploy` finds it (worker name must match the dashboard project).
function nitroTarget() {
  if (process.env["NITRO_PRESET"]) return {};
  if (process.env["WORKERS_CI"])
    return { preset: "cloudflare-module", cloudflare: { deployConfig: true, nodeCompat: true, wrangler: { name: process.env["WORKER_NAME"] || "misfinanzasperu", keep_vars: true } } };
  if (process.env["CF_PAGES"]) return { preset: "cloudflare-pages" };
  return {};
}

export default defineConfig(({ command, mode }) => {
  // Local dev: expose .env / .env.local to server functions (process.env), like Cloudflare does in production.
  if (command === "serve") for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ""))) process.env[k] ??= v;
  return {
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Keep server-only modules out of the browser bundle.
      importProtection: { behavior: "error", client: { files: ["**/server/**", "**/*.server.ts"], specifiers: ["server-only"] } },
      // Use src/server.ts (SSR error wrapper) as the server entry.
      server: { entry: "server" },
    }),
    ...(command === "build" ? [nitro(nitroTarget())] : []),
    viteReact(),
  ],
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  server: { port: 8080 },
  };
});
