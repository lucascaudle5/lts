import "server-only";

import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

/** Null when Supabase Auth is not configured; callers show a "not set up" state instead of crashing. */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Older Supabase integrations sync only the legacy anon key; it grants the same (auth-only) access.
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

/**
 * Auth-only client. The publishable key cannot read tables (RLS without policies), so this client
 * is used for sessions and nothing else; data goes through the server's Postgres connection.
 */
export function createAuthClient(config: SupabaseConfig, cookieMethods: CookieMethodsServer) {
  return createServerClient(config.url, config.publishableKey, { cookies: cookieMethods });
}

/** For Server Components, Server Actions, and Route Handlers. One client per request. */
export async function createRequestAuthClient(): Promise<SupabaseClient | null> {
  // Session checks compare token expiry with the clock, so they must run at request time, never
  // during prerendering (and never be skipped into a static result when env vars are missing).
  await connection();
  const store = await cookies();
  const config = getSupabaseConfig();
  if (!config) return null;
  return createAuthClient(config, {
    getAll: () => store.getAll(),
    setAll: (toSet) => {
      try {
        for (const { name, value, options } of toSet) store.set(name, value, options);
      } catch {
        // Server Components cannot set cookies; the proxy refreshes the session on the next request.
      }
    },
  });
}
