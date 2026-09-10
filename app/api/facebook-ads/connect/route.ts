import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentProfile } from "@/lib/auth";
import { canAccessSourcePnl, SOURCE_PNL_PATH } from "@/lib/finance/access";
import {
  FACEBOOK_ADS_OAUTH_SCOPES,
  facebookAdsOAuthConfigured,
  facebookAdsRedirectUri,
} from "@/lib/facebook-ads/config";
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

  if (!facebookAdsOAuthConfigured()) {
    return NextResponse.redirect(
      `${getSiteUrl()}${SOURCE_PNL_PATH}?facebook_ads=missing_env`,
    );
  }

  const state = randomBytes(24).toString("hex");
  const version = process.env.FACEBOOK_GRAPH_VERSION?.trim() || "21.0";
  const v = version.startsWith("v") ? version : `v${version}`;
  const url = new URL(`https://www.facebook.com/${v}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.FACEBOOK_APP_ID!.trim());
  url.searchParams.set("redirect_uri", facebookAdsRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", FACEBOOK_ADS_OAUTH_SCOPES);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("facebook_ads_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
