import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth";
import { canAccessSourcePnl, SOURCE_PNL_PATH } from "@/lib/finance/access";
import { getSiteUrl } from "@/lib/env";
import { facebookAdsRedirectUri } from "@/lib/facebook-ads/config";
import { exchangeFacebookCode } from "@/lib/facebook-ads/client";
import { saveFacebookAdsToken, syncFacebookAds } from "@/app/actions/facebook-ads";

export const dynamic = "force-dynamic";

function dash(query: string) {
  return NextResponse.redirect(`${getSiteUrl()}${SOURCE_PNL_PATH}?${query}`);
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !canAccessSourcePnl(profile)) {
    return dash("facebook_ads=auth");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = cookies();
  const expected = cookieStore.get("facebook_ads_oauth_state")?.value;

  const res = dash("facebook_ads=denied");
  res.cookies.delete("facebook_ads_oauth_state");

  if (!code || !state || !expected || state !== expected) {
    return res;
  }

  try {
    const tokens = await exchangeFacebookCode(code, facebookAdsRedirectUri());
    await saveFacebookAdsToken(tokens.accessToken, tokens.expiresAt);
    const synced = await syncFacebookAds();
    if (!synced.ok) return dash("facebook_ads=sync_error");
    const ok = dash("facebook_ads=connected");
    ok.cookies.delete("facebook_ads_oauth_state");
    return ok;
  } catch {
    const fail = dash("facebook_ads=error");
    fail.cookies.delete("facebook_ads_oauth_state");
    return fail;
  }
}
