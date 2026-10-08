import { pathToFileURL } from "node:url";

import { lt } from "drizzle-orm";

import { createDb } from "@/server/db/client";
import { loadLocalEnv, requireScriptEnv } from "@/server/db/local-env";
import { harnessRunPayloads } from "@/server/db/schema";

export async function pruneExpiredHarnessPayloads(url: string): Promise<number> {
  const db = createDb(url);
  try {
    const deleted = await db
      .delete(harnessRunPayloads)
      .where(lt(harnessRunPayloads.expiresAt, new Date()))
      .returning({ id: harnessRunPayloads.id });
    return deleted.length;
  } finally {
    await db.$client.end();
  }
}

async function main() {
  const loaded = loadLocalEnv();
  const url = requireScriptEnv("POSTGRES_URL_NON_POOLING", loaded);
  const deleted = await pruneExpiredHarnessPayloads(url);
  console.log(`Removed ${deleted} expired AI trace payload${deleted === 1 ? "" : "s"}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
