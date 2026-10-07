import { NextResponse, type NextRequest } from "next/server";

import { accessRedirect } from "@/server/access";
import { createAuthClient, getSupabaseConfig } from "@/server/supabase";

/** Refreshes the Supabase session cookie on every page request and gates signed-out access. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  let signedIn = false;

  const config = getSupabaseConfig();
  if (config) {
    const supabase = createAuthClient(config, {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, cacheHeaders) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
      },
    });
    try {
      const { data } = await supabase.auth.getClaims();
      signedIn = Boolean(data?.claims?.sub);
    } catch {
      signedIn = false;
    }
  }

  const target = accessRedirect(request.nextUrl.pathname, request.nextUrl.search, signedIn);
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
