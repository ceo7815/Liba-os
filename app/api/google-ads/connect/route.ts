import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentProfile } from "@/lib/auth";
import { canAccessSourcePnl, SOURCE_PNL_PATH } from "@/lib/finance/access";
import {
  GOOGLE_ADS_OAUTH_SCOPE,
  googleAdsDeveloperToken,
  googleAdsOAuthConfigured,
  googleAdsRedirectUri,
} from "@/lib/google-ads/config";
import { getSiteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.redirect(`${getSiteUrl()}/login`);
  }
  if (!canAccessSourcePnl(profile)) {
    return NextResponse.redirect(`${getSiteUrl()}/dashboard`);
  }

  if (!googleAdsOAuthConfigured() || !googleAdsDeveloperToken()) {
    return NextResponse.redirect(
      `${getSiteUrl()}${SOURCE_PNL_PATH}?google_ads=missing_env`,
    );
  }

  const state = randomBytes(24).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_ADS_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri", googleAdsRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_ADS_OAUTH_SCOPE);
  url.searchParams.set("access_type", "offline");
  // Don't force re-login. prompt=consent asks for a passkey this PC doesn't have.
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("login_hint", "ceo@beosystem.com");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("google_ads_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
