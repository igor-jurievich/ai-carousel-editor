import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
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

    const isAdmin = await checkIsAdmin({
      userId: session.user.id,
      supabaseUrl: config.supabaseUrl,
      supabase
    });

    if (!isAdmin) {
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

async function checkIsAdmin(params: {
  userId: string;
  supabaseUrl: string;
  supabase: ReturnType<typeof createMiddlewareClient>;
}) {
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (serviceRoleKey) {
    const serviceClient = createClient(params.supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("is_admin")
      .eq("id", params.userId)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to check is_admin in middleware (service role):", profileError);
      return false;
    }

    return Boolean(profile?.is_admin);
  }

  const { data: profile, error: profileError } = await params.supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", params.userId)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to check is_admin in middleware:", profileError);
    return false;
  }

  return Boolean(profile?.is_admin);
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
