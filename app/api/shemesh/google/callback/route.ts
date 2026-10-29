import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import { exchangeAuthCode, refreshAccessToken } from "@/lib/google-ads/client";
import { canManageShemesh } from "@/lib/permissions/access";
import { listShemeshGoogleCustomers, storeShemeshGoogleToken } from "@/lib/shemesh/connect";

export const dynamic = "force-dynamic";

function back(query: string) {
  return NextResponse.redirect(`${getSiteUrl()}/shemesh/sources?${query}`);
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !canManageShemesh(profile)) return back("google=auth");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = cookies().get("shemesh_google_oauth_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    const denied = back("google=denied");
    denied.cookies.delete("shemesh_google_oauth_state");
    return denied;
  }
  try {
    const redirectUri = `${getSiteUrl().replace(/\/$/, "")}/api/shemesh/google/callback`;
    const tokens = await exchangeAuthCode(code, redirectUri);
    const access = await refreshAccessToken(tokens.refreshToken);
    const customers = await listShemeshGoogleCustomers(access);
    await storeShemeshGoogleToken(tokens.refreshToken, null, customers);
    const ok = back("google=pick");
    ok.cookies.delete("shemesh_google_oauth_state");
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    console.error("[shemesh-google-callback]", message.slice(0, 180));
    const fail = back("google=error");
    fail.cookies.delete("shemesh_google_oauth_state");
    return fail;
  }
}
