import { existsSync } from "node:fs";

/**
 * Scripts (`db:migrate`, `db:seed`) run outside Next.js, so they load `.env.local` themselves.
 * Variables already set in the environment (e.g. by CI) take precedence.
 */
export function loadLocalEnv(file = ".env.local"): void {
  if (existsSync(file)) process.loadEnvFile(file);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env.local (see README).`);
  }
  return value;
}
