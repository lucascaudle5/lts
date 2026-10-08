import { NextResponse, type NextRequest } from "next/server";

import { SIGN_IN_PATH } from "@/server/access";
import { completeSignIn } from "@/server/auth";

/** Landing point of the magic link (set as `emailRedirectTo`). */
export async function GET(request: NextRequest) {
  const result = await completeSignIn(request.nextUrl.searchParams);
  const target = result.ok ? result.next : `${SIGN_IN_PATH}?notice=${result.notice}`;
  return NextResponse.redirect(new URL(target, request.url));
}
