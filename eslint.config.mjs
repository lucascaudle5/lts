import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * Import boundaries from docs/ARCHITECTURE.md ("Source layout and import boundaries").
 * Only one `no-restricted-imports` config applies per file, so every layer lists its full set.
 */

const crossFolderRelative = {
  regex: "^\\.\\./",
  message: "Import across folders with the @/ alias so layer boundaries can be checked.",
};

/** Repository write helpers live in `src/server/repositories/**\/*.writes.ts` (or `writes.ts`). */
const repositoryWrites = {
  regex: "^@/server/repositories/(.+/)?([^/]+\\.)?writes$",
  message: "Only src/server/mutations/** may call repository write helpers (runMutations).",
};

const forbid = (layers, message) => ({
  regex: `^@/(${layers.join("|")})(/|$)`,
  message,
});

const allowOnly = (allowed, message) => ({
  regex: `^(?!(${allowed.join("|")})$)`,
  message,
});

const boundary = (files, patterns) => ({
  files,
  rules: { "@typescript-eslint/no-restricted-imports": ["error", { patterns }] },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  boundary(["src/**/*.{ts,tsx}"], [crossFolderRelative, repositoryWrites]),
  boundary(
    ["src/contracts/**"],
    [
      crossFolderRelative,
      allowOnly(
        ["zod(/.*)?", "@/contracts/.*", "\\./.*", "vitest"],
        "src/contracts may import only zod (contracts stay pure).",
      ),
    ],
  ),
  boundary(
    ["src/domain/**"],
    [
      crossFolderRelative,
      allowOnly(
        ["@/contracts/.*", "@/domain/.*", "date-fns(/.*)?", "@date-fns/tz", "\\./.*", "vitest"],
        "src/domain may import only contracts and date-fns (no I/O).",
      ),
    ],
  ),
  boundary(
    ["src/ai/**"],
    [
      crossFolderRelative,
      repositoryWrites,
      {
        regex: "^@/server(/(?!tools(/|$)).*)?$",
        message: "src/ai may use server code only through src/server/tools.",
      },
      forbid(["app", "components"], "src/ai must not import UI or routes."),
    ],
  ),
  boundary(
    ["src/server/**"],
    [
      crossFolderRelative,
      repositoryWrites,
      forbid(["app", "components"], "src/server must not import UI or routes."),
    ],
  ),
  boundary(
    ["src/server/mutations/**"],
    [crossFolderRelative, forbid(["app", "components", "ai"], "Mutations depend on data only.")],
  ),
  boundary(
    ["src/app/**"],
    [
      crossFolderRelative,
      repositoryWrites,
      forbid(["domain", "ai"], "Routes call src/server, which owns domain rules and AI."),
      {
        regex: "^@/server/db(/|$)",
        message: "Routes read through repositories, never the DB client or schema directly.",
      },
    ],
  ),
  boundary(
    ["src/components/**"],
    [
      crossFolderRelative,
      repositoryWrites,
      forbid(["server", "ai", "domain", "app"], "Components get data as props."),
      {
        regex: "^@/contracts(/|$)",
        allowTypeImports: true,
        message: "Components may import contract types only (import type).",
      },
    ],
  ),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
