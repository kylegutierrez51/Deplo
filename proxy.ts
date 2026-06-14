import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth.config";

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};

export default async function proxy(request: NextRequest) {
  const session = await auth(); // auth function gives access to session

  // without the !== '/', when user is on '/', proxy.ts causes an infinite redirect
  if (!session && request.nextUrl.pathname !== "/") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next();
}
