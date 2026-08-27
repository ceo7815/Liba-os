import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/set-password",
  "/auth",
  "/r",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/portals") ||
    pathname.startsWith("/vault") ||
    pathname.startsWith("/finance") ||
    pathname.startsWith("/employees") ||
    pathname.startsWith("/sales-dashboard")
  );
}

/**
 * Fast session gate: JWT claims only — no profile DB round-trip per navigation.
 * Authoritative profile / is_active checks happen in the authenticated layout.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Prefer local JWT claims; only hit Auth API when claims are missing/expired.
  const { data: claimsData } = await supabase.auth.getClaims();
  let userId = claimsData?.claims?.sub as string | undefined;

  if (!userId) {
    const { data: userData } = await supabase.auth.getUser();
    userId = userData.user?.id;
  }

  const pathname = request.nextUrl.pathname;

  if (!userId) {
    if (isProtectedPath(pathname) || pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (pathname === "/login" || pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isPublicPath(pathname) && !isProtectedPath(pathname) && pathname !== "/") {
    return supabaseResponse;
  }

  return supabaseResponse;
}
