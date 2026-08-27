// frontend/platform-ui/middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  let token = null;
  try {
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } catch {
    token = null;
  }

  // If user is accessing a protected page route without a valid session token
  if (!token) {
    const fullCallback = `${pathname}${search}`;
    const redirectUrl = new URL("/session-expired", req.url);
    redirectUrl.searchParams.set("reason", "unauthenticated");
    redirectUrl.searchParams.set("callbackUrl", fullCallback);

    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/scans/:path*",
    "/findings/:path*",
    "/assets/:path*",
    "/compliance/:path*",
    "/executive/:path*",
    "/reports/:path*",
    "/remediation-hub/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/demo-guide/:path*",
  ],
};
