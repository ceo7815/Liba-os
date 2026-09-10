import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth";
import { canAccessSourcePnl, SOURCE_PNL_PATH } from "@/lib/finance/access";
import { getSiteUrl } from "@/lib/env";
import {
  envCustomerId,
  envLoginCustomerId,
  googleAdsRedirectUri,
} from "@/lib/google-ads/config";
import {
  exchangeAuthCode,
  listAccessibleCustomerIds,
  refreshAccessToken,
} from "@/lib/google-ads/client";
import {
  saveGoogleAdsCustomerId,
  saveGoogleAdsRefreshToken,
  syncGoogleAds,
} from "@/app/actions/google-ads";

export const dynamic = "force-dynamic";

function dash(query: string) {
  return NextResponse.redirect(`${getSiteUrl()}${SOURCE_PNL_PATH}?${query}`);
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !canAccessSourcePnl(profile)) {
    return dash("google_ads=auth");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = cookies();
  const expected = cookieStore.get("google_ads_oauth_state")?.value;

  const res = dash("google_ads=denied");
  res.cookies.delete("google_ads_oauth_state");

  if (!code || !state || !expected || state !== expected) {
    return res;
  }

  try {
    const tokens = await exchangeAuthCode(code, googleAdsRedirectUri());
    await saveGoogleAdsRefreshToken(tokens.refreshToken);
    const access = tokens.accessToken || (await refreshAccessToken(tokens.refreshToken));
    const accounts = await listAccessibleCustomerIds(access);
    const preferred = envCustomerId();
    const login = envLoginCustomerId();
    const customer = preferred || (accounts.length === 1 ? accounts[0] : null);
    if (customer) {
      const saved = await saveGoogleAdsCustomerId(customer, login ?? undefined);
      if (!saved.ok) return dash("google_ads=error");
      const synced = await syncGoogleAds();
      if (!synced.ok) return dash("google_ads=sync_error");
      const ok = dash("google_ads=connected");
      ok.cookies.delete("google_ads_oauth_state");
      return ok;
    }
    const pick = dash("google_ads=pick");
    pick.cookies.delete("google_ads_oauth_state");
    return pick;
  } catch {
    const fail = dash("google_ads=error");
    fail.cookies.delete("google_ads_oauth_state");
    return fail;
  }
}
