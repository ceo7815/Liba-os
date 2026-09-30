"use server";

import { requireProfile } from "@/lib/auth";
import { canAccessSourcePnl } from "@/lib/finance/access";
import { canAccessSalesDashboard } from "@/lib/sales-dashboard/access";
import {
  facebookAdsStatusLabel,
  googleAdsStatusLabel,
  jerusalemYmd,
} from "@/lib/sales-dashboard/campaign-math";
import { readFacebookAdsBundle } from "@/app/actions/facebook-ads";
import { readGoogleAdsBundle, readGoogleCallDetails } from "@/app/actions/google-ads";
import { createAdminClient } from "@/lib/supabase/admin";
import { JERUSALEM_TZ } from "@/lib/sales-dashboard/columns";
import {
  isInboundCampaign,
  phonesFromCallMetadata,
  type CallDay,
  type CampaignBoard,
  type CampaignPoint,
  type CampaignRow,
  type DeskCallLine,
  type PhoneLine,
} from "@/lib/campaigns/board";

const PAGE = 1000;
const CALL_CAP = 30000;

function historyStart(today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() - 36);
  return date.toISOString().slice(0, 10);
}

function bucketPoints(
  rows: { id: string; day: string; cost: number; leads: number; clicks: number; impressions: number }[],
): Map<string, CampaignPoint[]> {
  const byId = new Map<string, CampaignPoint[]>();
  for (const row of rows) {
    const list = byId.get(row.id) ?? [];
    list.push({
      day: row.day,
      cost: row.cost,
      leads: row.leads,
      clicks: row.clicks,
      impressions: row.impressions,
    });
    byId.set(row.id, list);
  }
  return byId;
}

async function loadCalls(historyFrom: string, today: string): Promise<CampaignBoard["calls"]> {
  const empty = { days: [], phones: [], truncated: false };
  const admin = createAdminClient();
  const fromIso = `${historyFrom}T00:00:00+03:00`;
  const toIso = `${today}T23:59:59+03:00`;
  const days = new Map<string, CallDay>();
  const phones = new Map<string, Map<string, { count: number; durationSec: number }>>();
  let seen = 0;
  let truncated = false;

  for (let from = 0; from < CALL_CAP; from += PAGE) {
    const { data, error } = await admin
      .from("calls")
      .select("call_date, duration_sec, metadata")
      .eq("source", "voicenter")
      .gte("call_date", fromIso)
      .lte("call_date", toIso)
      .order("call_date", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      if (/relation .+ does not exist|schema cache|could not find the table/i.test(error.message)) {
        return empty;
      }
      throw new Error(error.message);
    }
    const rows = data ?? [];
    for (const row of rows) {
      const stamp = row.call_date ? new Date(row.call_date) : null;
      if (!stamp || Number.isNaN(stamp.getTime())) continue;
      const day = jerusalemYmd(stamp);
      if (day < historyFrom || day > today) continue;
      const durationRaw = row.duration_sec;
      const duration =
        typeof durationRaw === "number"
          ? durationRaw
          : durationRaw == null
            ? null
            : Number(durationRaw);
      const durationSec = duration != null && Number.isFinite(duration) && duration > 0 ? duration : 0;
      const bucket = days.get(day) ?? { day, count: 0, durationSec: 0 };
      bucket.count += 1;
      bucket.durationSec += durationSec;
      days.set(day, bucket);
      const found = phonesFromCallMetadata(row.metadata);
      const add = (number: string | null, kind: PhoneLine["kind"]) => {
        if (!number) return;
        const key = `${kind}:${number}`;
        const byDay = phones.get(key) ?? new Map();
        const slot = byDay.get(day) ?? { count: 0, durationSec: 0 };
        slot.count += 1;
        slot.durationSec += durationSec;
        byDay.set(day, slot);
        phones.set(key, byDay);
      };
      add(found.caller, "caller");
      add(found.dialed, "dialed");
      seen += 1;
    }
    if (rows.length < PAGE) break;
    if (from + PAGE >= CALL_CAP) truncated = true;
  }

  const phoneLines: PhoneLine[] = Array.from(phones.entries())
    .map(([key, byDay]) => {
      const [kind, number] = key.split(":") as [PhoneLine["kind"], string];
      const series = Array.from(byDay.entries())
        .map(([day, slot]) => ({ day, count: slot.count, durationSec: slot.durationSec }))
        .sort((a, b) => a.day.localeCompare(b.day));
      const total = series.reduce((sum, slot) => sum + slot.count, 0);
      return { number, kind, days: series, total };
    })
    .sort((a, b) => b.total - a.total || a.number.localeCompare(b.number, "he"))
    .slice(0, 40)
    .map(({ number, kind, days }) => ({ number, kind, days }));

  return {
    days: Array.from(days.values()).sort((a, b) => a.day.localeCompare(b.day)),
    phones: phoneLines,
    truncated: truncated || seen >= CALL_CAP,
  };
}

function jerusalemClock(stamp: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: JERUSALEM_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(stamp);
}

export async function loadDeskCalls(fromDay: string, toDay: string): Promise<DeskCallLine[]> {
  const profile = await requireProfile();
  if (!canAccessSalesDashboard(profile) && !canAccessSourcePnl(profile)) {
    throw new Error("אין הרשאה לקמפיינים");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay) || !/^\d{4}-\d{2}-\d{2}$/.test(toDay) || fromDay > toDay) {
    return [];
  }
  const admin = createAdminClient();
  const fromIso = `${fromDay}T00:00:00+03:00`;
  const toIso = `${toDay}T23:59:59+03:00`;
  const lines: { at: number; time: string; durationSec: number }[] = [];
  for (let from = 0; from < CALL_CAP; from += PAGE) {
    const { data, error } = await admin
      .from("calls")
      .select("call_date, duration_sec")
      .eq("source", "voicenter")
      .gte("call_date", fromIso)
      .lte("call_date", toIso)
      .order("call_date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      if (/relation .+ does not exist|schema cache|could not find the table/i.test(error.message)) return [];
      throw new Error(error.message);
    }
    const rows = data ?? [];
    for (const row of rows) {
      const stamp = row.call_date ? new Date(row.call_date) : null;
      if (!stamp || Number.isNaN(stamp.getTime())) continue;
      const durationRaw = row.duration_sec;
      const duration =
        typeof durationRaw === "number" ? durationRaw : durationRaw == null ? null : Number(durationRaw);
      const durationSec = duration != null && Number.isFinite(duration) && duration > 0 ? duration : 0;
      lines.push({ at: stamp.getTime(), time: jerusalemClock(stamp), durationSec });
    }
    if (rows.length < PAGE) break;
  }
  lines.sort((a, b) => a.at - b.at);
  return lines.map(({ time, durationSec }) => ({ time, durationSec }));
}

export async function loadCampaignBoard(): Promise<CampaignBoard> {
  const profile = await requireProfile();
  if (!canAccessSalesDashboard(profile) && !canAccessSourcePnl(profile)) {
    throw new Error("אין הרשאה לקמפיינים");
  }
  const today = jerusalemYmd();
  const historyFrom = historyStart(today);
  const [google, facebook, calls, googleCalls] = await Promise.all([
    readGoogleAdsBundle(),
    readFacebookAdsBundle(),
    loadCalls(historyFrom, today),
    readGoogleCallDetails(historyFrom, today),
  ]);

  const googlePoints = bucketPoints(
    google.stats.map((row) => ({
      id: row.googleCampaignId,
      day: row.day,
      cost: row.cost,
      leads: row.leads,
      clicks: row.clicks,
      impressions: row.impressions,
    })),
  );
  const facebookPoints = bucketPoints(
    facebook.stats.map((row) => ({
      id: row.facebookCampaignId,
      day: row.day,
      cost: row.cost,
      leads: row.leads,
      clicks: row.clicks,
      impressions: row.impressions,
    })),
  );

  const googleCampaigns: CampaignRow[] = google.campaigns.map((row) => {
    const status = row.status.toUpperCase();
    return {
      id: row.googleCampaignId,
      name: row.googleCampaignName,
      status: googleAdsStatusLabel(status),
      active: status === "ENABLED",
      sourceName: row.sourceName,
      inbound: isInboundCampaign(row.googleCampaignName, row.sourceName),
      points: googlePoints.get(row.googleCampaignId) ?? [],
    };
  });
  const facebookCampaigns: CampaignRow[] = facebook.campaigns.map((row) => {
    const status = row.status.toUpperCase();
    return {
      id: row.facebookCampaignId,
      name: row.facebookCampaignName,
      status: facebookAdsStatusLabel(status),
      active: status === "ACTIVE",
      sourceName: row.sourceName,
      inbound: false,
      points: facebookPoints.get(row.facebookCampaignId) ?? [],
    };
  });

  return {
    today,
    historyFrom,
    canSync: canAccessSourcePnl(profile),
    google: {
      connected: google.connection.connected,
      lastSyncedAt: google.connection.lastSyncedAt,
      lastError: google.connection.lastError,
      campaigns: googleCampaigns,
    },
    facebook: {
      connected: facebook.connection.connected,
      lastSyncedAt: facebook.connection.lastSyncedAt,
      lastError: facebook.connection.lastError,
      campaigns: facebookCampaigns,
    },
    calls,
    googleCalls,
  };
}
