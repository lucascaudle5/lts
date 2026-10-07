import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export const sharedResolve = {
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    // `server-only` throws outside React Server Components; tests are server code.
    "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
  },
};

export default defineConfig({
  resolve: sharedResolve,
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.db.test.ts"],
    environment: "node",
  },
});
