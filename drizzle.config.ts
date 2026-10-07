import { defineConfig } from "drizzle-kit";

import { cleanDatabaseUrl } from "./src/server/db/connection";
import { loadLocalEnv, requireScriptEnv } from "./src/server/db/local-env";

const loaded = loadLocalEnv();

/** `db:generate` only diffs the schema against db/migrations/, so it needs no database. */
const needsDatabase = !process.argv.includes("generate");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: needsDatabase
      ? cleanDatabaseUrl(requireScriptEnv("POSTGRES_URL_NON_POOLING", loaded))
      : (process.env.POSTGRES_URL_NON_POOLING ?? ""),
  },
  migrations: { table: "__drizzle_migrations", schema: "drizzle" },
  strict: true,
  verbose: true,
});
