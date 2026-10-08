import { NextResponse, type NextRequest } from "next/server";

import { completePasswordRecovery } from "@/server/auth";

/** Landing point for an explicitly requested password recovery email. */
export async function GET(request: NextRequest) {
  const result = await completePasswordRecovery(request.nextUrl.searchParams);
  const target = result.ok ? "/reset-password" : "/forgot-password?notice=recovery_link_invalid";
  return NextResponse.redirect(new URL(target, request.url));
}
