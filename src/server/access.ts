/** Routes that work without a session. Everything else requires one (default deny). */
const PUBLIC_PATHS = [
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/api/health",
  "/demo",
];

export const HOME_PATH = "/today";
export const SIGN_IN_PATH = "/sign-in";

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * A same-site path to continue to after sign-in, or Today. Rejects absolute and
 * protocol-relative URLs so a crafted link cannot bounce the user to another site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return HOME_PATH;
  }
  if (next === SIGN_IN_PATH || next.startsWith(`${SIGN_IN_PATH}?`) || next.startsWith("/auth/")) {
    return HOME_PATH;
  }
  return next;
}

/** Where the proxy should send this request, or null to let it through. */
export function accessRedirect(pathname: string, search: string, signedIn: boolean): string | null {
  if (signedIn) {
    return pathname === SIGN_IN_PATH || pathname === "/" ? HOME_PATH : null;
  }
  if (isPublic(pathname)) return null;
  if (pathname === "/") return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(`${pathname}${search}`)}`;
}
