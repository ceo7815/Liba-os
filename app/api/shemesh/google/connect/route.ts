import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentProfile } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import { GOOGLE_ADS_OAUTH_SCOPE } from "@/lib/google-ads/config";
import { resolveGoogleDeveloperToken, resolveGoogleOAuthClient } from "@/lib/google-ads/credentials";
import { canManageShemesh } from "@/lib/permissions/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  const site = getSiteUrl();
  if (!profile) return NextResponse.redirect(`${site}/login`);
  if (!canManageShemesh(profile)) return NextResponse.redirect(`${site}/shemesh`);
  let clientId = "";
  try {
    clientId = (await resolveGoogleOAuthClient()).clientId;
    await resolveGoogleDeveloperToken();
  } catch {
    return NextResponse.redirect(`${site}/shemesh/sources?google=missing_env`);
  }
  const state = randomBytes(24).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${site.replace(/\/$/, "")}/api/shemesh/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_ADS_OAUTH_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url.toString());
  res.cookies.set("shemesh_google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
