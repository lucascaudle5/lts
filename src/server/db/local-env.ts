import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

/** The database of the local Supabase stack (`supabase start`); also the `.env.example` default. */
export const LOCAL_SUPABASE_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const LOCAL_ENV_FILES = [".env.local", ".env"] as const;

/**
 * Windows editors and PowerShell redirection (`>`) often save UTF-16 or add a BOM, which
 * `process.loadEnvFile` reads as garbage, silently leaving every variable unset.
 */
function decodeEnvFile(bytes: Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString("utf16le");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.from(bytes.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  return bytes.toString("utf8").replace(/^\uFEFF/, "");
}

/**
 * Scripts (`db:migrate`, `db:seed`, `test:db`) run outside Next.js, so they load `.env.local`, then
 * `.env`, from `root` themselves. Variables already set in the environment (e.g. by CI or
 * `dotenv -e`) take precedence. Returns the files that were read.
 */
export function loadLocalEnv(root: string = process.cwd()): string[] {
  const loaded: string[] = [];
  for (const name of LOCAL_ENV_FILES) {
    const file = resolve(root, name);
    if (!existsSync(file)) continue;
    const values = parseEnv(decodeEnvFile(readFileSync(file)));
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
    loaded.push(name);
  }
  return loaded;
}

/** For scripts: the variable's value, or an error that says exactly how to fix it. */
export function requireScriptEnv(name: string, loaded: string[]): string {
  const value = process.env[name];
  if (value) return value;
  const where =
    loaded.length > 0 ? `${loaded.join(" and ")} did not set it` : "no .env.local found";
  throw new Error(
    `${name} is not set (${where}). Create .env.local from the template in the repo root: ` +
      "`cp .env.example .env.local` (Windows: `copy .env.example .env.local`). " +
      `For the local Supabase stack it is ${LOCAL_SUPABASE_DB_URL}`,
  );
}
