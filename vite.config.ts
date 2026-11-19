import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Deploy target: Cloudflare Pages when built there (CF_PAGES is set by Cloudflare),
// otherwise Nitro auto-detects (plain Node server locally). Override with NITRO_PRESET.
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
    ...(command === "build" ? [nitro(process.env["CF_PAGES"] && !process.env["NITRO_PRESET"] ? { preset: "cloudflare-pages" } : {})] : []),
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
