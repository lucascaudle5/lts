import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { cleanDatabaseUrl } from "./connection";
import { requireEnv } from "./env";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

/**
 * Prepared statements stay off because production uses Supabase's transaction-mode pooler, and
 * each serverless instance keeps a single connection.
 */
export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(cleanDatabaseUrl(url), { prepare: false, max: options.max ?? 1 });
  return drizzle(client, { schema });
}

let runtimeDb: Db | undefined;

/** The app's runtime connection (`POSTGRES_URL`). */
export function getDb(): Db {
  runtimeDb ??= createDb(requireEnv("POSTGRES_URL"));
  return runtimeDb;
}
