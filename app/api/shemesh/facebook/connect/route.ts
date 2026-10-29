import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentProfile } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import {
  FACEBOOK_ADS_OAUTH_SCOPES,
  facebookAdsOAuthConfigured,
  facebookGraphVersion,
} from "@/lib/facebook-ads/config";
import { canManageShemesh } from "@/lib/permissions/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  const site = getSiteUrl();
  if (!profile) return NextResponse.redirect(`${site}/login`);
  if (!canManageShemesh(profile)) return NextResponse.redirect(`${site}/shemesh`);
  if (!facebookAdsOAuthConfigured()) {
    return NextResponse.redirect(`${site}/shemesh/sources?facebook=missing_env`);
  }
  const state = randomBytes(24).toString("hex");
  const url = new URL(`https://www.facebook.com/${facebookGraphVersion()}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.FACEBOOK_APP_ID!.trim());
  url.searchParams.set("redirect_uri", `${site.replace(/\/$/, "")}/api/shemesh/facebook/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", FACEBOOK_ADS_OAUTH_SCOPES);
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url.toString());
  res.cookies.set("shemesh_facebook_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
