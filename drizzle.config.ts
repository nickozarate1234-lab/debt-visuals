import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Local: SUPABASE_DB_URL lives in .env.local (Supabase → Connect → Session pooler). Never commit it.
if (!process.env.SUPABASE_DB_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL ?? "",
  },
});
