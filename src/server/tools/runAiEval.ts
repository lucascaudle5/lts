import { pathToFileURL } from "node:url";

import { runEval } from "@/ai/eval";
import { loadLocalEnv } from "@/server/db/local-env";

async function main() {
  loadLocalEnv();
  const model = process.env.LTS_AI_MODEL;
  if (!model) throw new Error("Set LTS_AI_MODEL in .env.local before running pnpm eval.");
  const result = await runEval(model);
  if (result.fixtureCount < 20) throw new Error("At least 20 golden fixtures are required.");
  if (result.accuracy < 0.9) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
