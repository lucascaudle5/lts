import { defineConfig } from "drizzle-kit";

import { cleanDatabaseUrl } from "./src/server/db/connection";
import { loadLocalEnv, requireScriptEnv } from "./src/server/db/local-env";

const loaded = loadLocalEnv();

/** `db:generate` only diffs the schema against db/migrations/, so it needs no database. */
const needsDatabase = !process.argv.includes("generate");

function databaseUrl(): string {
  if (!needsDatabase) return process.env.POSTGRES_URL_NON_POOLING ?? "";
  const url = cleanDatabaseUrl(requireScriptEnv("POSTGRES_URL_NON_POOLING", loaded));
  const { host, pathname } = new URL(url);
  // Shown so a production run can't silently fall back to the local database from .env.local.
  console.error(`Database: ${host}${pathname}`);
  return url;
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: databaseUrl() },
  migrations: { table: "__drizzle_migrations", schema: "drizzle" },
  strict: true,
  verbose: true,
});
