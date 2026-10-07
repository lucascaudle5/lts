import { defineConfig } from "drizzle-kit";

import { loadLocalEnv } from "./src/server/db/env";

loadLocalEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: process.env.POSTGRES_URL_NON_POOLING ?? "" },
  migrations: { table: "__drizzle_migrations", schema: "drizzle" },
  strict: true,
  verbose: true,
});
