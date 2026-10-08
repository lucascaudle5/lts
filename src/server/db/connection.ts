const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLocalDatabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Query parameters postgres.js interprets itself; anything else it would send to the server. */
const DRIVER_PARAMS = new Set(["sslmode"]);

/**
 * Makes a hosted connection string safe for postgres.js (runtime) and drizzle-kit (migrations):
 * postgres.js forwards unknown query parameters (the Vercel Marketplace adds e.g.
 * `supa=base-pooler.x`) as Postgres startup parameters, which the server can reject. Non-local
 * hosts get `sslmode=require` unless a mode is already set.
 */
export function cleanDatabaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (!DRIVER_PARAMS.has(key)) url.searchParams.delete(key);
  }
  if (!isLocalDatabaseUrl(raw) && !url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  return url.toString();
}
