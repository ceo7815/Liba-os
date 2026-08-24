import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/** Only run on app routes that need auth — skip /api/mcp, static, etc. */
export const config = {
  matcher: [
    "/",
    "/login",
    "/forgot-password",
    "/set-password",
    "/auth/:path*",
    "/dashboard/:path*",
    "/agents/:path*",
    "/portals/:path*",
    "/vault/:path*",
    "/finance/:path*",
    "/employees/:path*",
    "/sales-dashboard/:path*",
    "/sales-tv",
  ],
};
