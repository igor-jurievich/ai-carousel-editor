import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { getSupabasePublicConfig } from "@/lib/supabase";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const config = getSupabasePublicConfig();
  if (!config) {
    return response;
  }

  const supabase = createMiddlewareClient({
    req: request,
    res: response
  }, {
    supabaseUrl: config.supabaseUrl,
    supabaseKey: config.supabaseKey
  });

  const {
    data: { session }
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  const isRootRoute = pathname === "/";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
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

  if (isAdminRoute) {
    if (!session) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/generate";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError || !profile?.is_admin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/generate";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
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
    "/admin",
    "/admin/:path*",
    "/login",
    "/onboarding"
  ]
};
