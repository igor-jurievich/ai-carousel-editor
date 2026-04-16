import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createMiddlewareClient({
    req: request,
    res: response
  });

  const {
    data: { session }
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  const isRootRoute = pathname === "/";
  const isProtectedRoute = pathname === "/generate" || pathname.startsWith("/editor");
  const isAuthRoute = pathname === "/login" || pathname === "/onboarding";

  if (isRootRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = session ? "/generate" : "/onboarding";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (!session && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (session && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/generate";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/generate",
    "/generate/:path*",
    "/editor",
    "/editor/:path*",
    "/login",
    "/onboarding"
  ]
};
