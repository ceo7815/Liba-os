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
  fetchGoogleAccountEmail,
  listAccessibleCustomerIds,
  refreshAccessToken,
} from "@/lib/google-ads/client";
import {
  saveGoogleAdsCustomerId,
  saveGoogleAdsRefreshToken,
  syncGoogleAds,
} from "@/app/actions/google-ads";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicErrorText } from "@/lib/sync-log";

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
    const access = tokens.accessToken || (await refreshAccessToken(tokens.refreshToken));
    const email = await fetchGoogleAccountEmail(access);
    await saveGoogleAdsRefreshToken(tokens.refreshToken, email);
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
  } catch (error) {
    const message = publicErrorText(
      error instanceof Error ? error.message : "חיבור גוגל אדס נכשל",
    ).slice(0, 180);
    console.error("[google-ads-callback]", { message });
    try {
      const admin = createAdminClient();
      await admin.from("google_ads_settings").upsert({
        id: 1,
        last_error: message,
        updated_at: new Date().toISOString(),
      });
    } catch (writeError) {
      const detail = publicErrorText(
        writeError instanceof Error ? writeError.message : "last_error write failed",
      );
      console.error("[google-ads-callback]", { message: detail });
    }
    const fail = dash(`google_ads=error&reason=${encodeURIComponent(message)}`);
    fail.cookies.delete("google_ads_oauth_state");
    return fail;
  }
}
