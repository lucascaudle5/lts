import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LOCAL_SUPABASE_DB_URL, loadLocalEnv, requireScriptEnv } from "./local-env";

const KEY = "LTS_TEST_ENV_URL";
const OTHER = "LTS_TEST_ENV_OTHER";
const content = `# comment\r\n${KEY}=${LOCAL_SUPABASE_DB_URL}\r\n${OTHER}="quoted value"\r\n`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lts-env-"));
  delete process.env[KEY];
  delete process.env[OTHER];
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env[KEY];
  delete process.env[OTHER];
});

describe("loadLocalEnv", () => {
  it.each([
    ["UTF-8 with CRLF", Buffer.from(content, "utf8")],
    ["UTF-8 with BOM", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content)])],
    [
      "UTF-16 LE (PowerShell >)",
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, "utf16le")]),
    ],
  ])("reads %s", (_label, bytes) => {
    writeFileSync(join(dir, ".env.local"), bytes);
    expect(loadLocalEnv(dir)).toEqual([".env.local"]);
    expect(process.env[KEY]).toBe(LOCAL_SUPABASE_DB_URL);
    expect(process.env[OTHER]).toBe("quoted value");
  });

  it("prefers the environment, then .env.local, then .env", () => {
    process.env[OTHER] = "from environment";
    writeFileSync(join(dir, ".env.local"), `${KEY}=local\n`);
    writeFileSync(join(dir, ".env"), `${KEY}=dotenv\n${OTHER}=dotenv\n`);
    expect(loadLocalEnv(dir)).toEqual([".env.local", ".env"]);
    expect(process.env[KEY]).toBe("local");
    expect(process.env[OTHER]).toBe("from environment");
  });

  it("does nothing without env files", () => {
    expect(loadLocalEnv(dir)).toEqual([]);
    expect(process.env[KEY]).toBeUndefined();
  });
});

describe("requireScriptEnv", () => {
  it("explains how to create .env.local when the variable is missing", () => {
    expect(() => requireScriptEnv(KEY, [])).toThrow(/no \.env\.local found.*copy \.env\.example/);
    expect(() => requireScriptEnv(KEY, [".env.local"])).toThrow(LOCAL_SUPABASE_DB_URL);
  });

  it("returns the value when set", () => {
    process.env[KEY] = "x";
    expect(requireScriptEnv(KEY, [])).toBe("x");
  });
});
