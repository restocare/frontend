import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GONE_PATHS } from "./lib/redirects";

const GONE_SET = new Set(GONE_PATHS);

/** Serves 410 Gone for retired URLs — see lib/redirects.ts and docs/seo/404-resolution.md. */
export function proxy(request: NextRequest) {
  if (GONE_SET.has(request.nextUrl.pathname)) {
    return new NextResponse("Gone", { status: 410 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
};
