import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint();
});

async function violations(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${code}\nexport {};\n`, { filePath });
  return result.messages
    .filter((m) => m.ruleId === "@typescript-eslint/no-restricted-imports")
    .map((m) => m.message);
}

describe("import boundaries (docs/ARCHITECTURE.md)", () => {
  it.each([
    ["src/contracts/x.ts", 'import "date-fns";'],
    ["src/contracts/x.ts", 'import "@/domain/dates";'],
    ["src/domain/x.ts", 'import "@/server/db/client";'],
    ["src/domain/x.ts", 'import "postgres";'],
    ["src/domain/x.ts", 'import "node:fs";'],
    ["src/domain/x.ts", 'import "../server/db/client";'],
    ["src/ai/x.ts", 'import "@/server/db/client";'],
    ["src/ai/x.ts", 'import "@/server/repositories/tasks";'],
    ["src/server/x.ts", 'import "@/components/ui/button";'],
    ["src/server/approval/x.ts", 'import "@/server/repositories/tasks.writes";'],
    ["src/app/today/page.tsx", 'import "@/server/repositories/writes";'],
    ["src/app/today/page.tsx", 'import "@/server/db/client";'],
    ["src/app/today/page.tsx", 'import "@/domain/dates";'],
    ["src/components/today/x.tsx", 'import { getDb } from "@/server/db/client";'],
    ["src/components/today/x.tsx", 'import { TaskKind } from "@/contracts/common";'],
  ])("%s rejects %s", async (file, code) => {
    expect(await violations(file, code)).not.toEqual([]);
  });

  it.each([
    ["src/contracts/x.ts", 'import { z } from "zod";'],
    ["src/contracts/x.ts", 'import "./common";'],
    ["src/domain/x.ts", 'import "@/contracts/common";\nimport "date-fns";\nimport "@date-fns/tz";'],
    ["src/ai/x.ts", 'import "@/server/tools/getToday";\nimport "@/domain/dates";'],
    ["src/server/mutations/x.ts", 'import "@/server/repositories/tasks.writes";'],
    ["src/server/mutations/x.ts", 'import "@/server/repositories/writes";'],
    ["src/server/db/x.ts", 'import "@/domain/dates";\nimport "./schema";'],
    ["src/app/today/page.tsx", 'import "@/server/repositories/tasks";\nimport "@/lib/utils";'],
    ["src/components/today/x.tsx", 'import type { TaskKind } from "@/contracts/common";'],
  ])("%s allows %s", async (file, code) => {
    expect(await violations(file, code)).toEqual([]);
  });
});
