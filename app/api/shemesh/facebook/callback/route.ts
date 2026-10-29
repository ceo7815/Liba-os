import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import { exchangeFacebookCode } from "@/lib/facebook-ads/client";
import { canManageShemesh } from "@/lib/permissions/access";
import { storeShemeshFacebookToken } from "@/lib/shemesh/connect";

export const dynamic = "force-dynamic";

function back(query: string) {
  return NextResponse.redirect(`${getSiteUrl()}/shemesh/sources?${query}`);
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !canManageShemesh(profile)) return back("facebook=auth");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = cookies().get("shemesh_facebook_oauth_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    const denied = back("facebook=denied");
    denied.cookies.delete("shemesh_facebook_oauth_state");
    return denied;
  }
  try {
    const redirectUri = `${getSiteUrl().replace(/\/$/, "")}/api/shemesh/facebook/callback`;
    const tokens = await exchangeFacebookCode(code, redirectUri);
    await storeShemeshFacebookToken(tokens.accessToken, tokens.expiresAt ?? null, null);
    const ok = back("facebook=connected");
    ok.cookies.delete("shemesh_facebook_oauth_state");
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    console.error("[shemesh-facebook-callback]", message.slice(0, 180));
    const fail = back("facebook=error");
    fail.cookies.delete("shemesh_facebook_oauth_state");
    return fail;
  }
}
