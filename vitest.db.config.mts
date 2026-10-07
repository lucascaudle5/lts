import { defineConfig } from "vitest/config";

import { sharedResolve } from "./vitest.config.mts";

/** DB integration tests: need a disposable local Postgres (see README, "Database"). */
export default defineConfig({
  resolve: sharedResolve,
  test: {
    include: ["src/**/*.db.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
