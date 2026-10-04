import { GOOGLE_ADS_CUBE_SOURCE } from "@/lib/sales-dashboard/campaign-math";

export type CampaignPoint = {
  day: string;
  cost: number;
  leads: number;
  clicks: number;
  impressions: number;
};

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  active: boolean;
  sourceName: string | null;
  inbound: boolean;
  points: CampaignPoint[];
};

export type ChannelBoard = {
  connected: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  campaigns: CampaignRow[];
};

export type PhoneDay = {
  day: string;
  count: number;
  durationSec: number;
};

export type PhoneLine = {
  number: string;
  kind: "caller" | "dialed";
  days: PhoneDay[];
};

export type CallDay = {
  day: string;
  count: number;
  durationSec: number;
};

export type DeskCallLine = {
  time: string;
  durationSec: number;
};

export type InboundCalls = {
  days: CallDay[];
  phones: PhoneLine[];
  truncated: boolean;
};

export type GoogleCallLine = {
  at: string;
  day: string;
  time: string;
  durationSec: number;
  status: string;
  campaignName: string;
  area: string;
  kind: string;
  place: string;
};

export type CampaignBoard = {
  today: string;
  historyFrom: string;
  canSync: boolean;
  google: ChannelBoard;
  facebook: ChannelBoard;
  calls: InboundCalls;
  googleCalls: GoogleCallLine[];
  googleCallsError: string | null;
};

const CALLER_KEYS = [
  "caller",
  "caller_number",
  "callerid",
  "cli",
  "from",
  "from_number",
  "phone",
  "phone_number",
  "customer_phone",
  "ani",
];
const DIALED_KEYS = [
  "did",
  "dnis",
  "destination",
  "to",
  "to_number",
  "target",
  "dialed",
  "called_number",
  "callee",
];

export function isInboundCampaign(name: string, sourceName: string | null): boolean {
  const source = (sourceName ?? "").replace(/\s+/g, " ").trim();
  if (source === GOOGLE_ADS_CUBE_SOURCE) return true;
  return name.includes("שיחות נכנסות");
}

export function sumPoints(points: CampaignPoint[], from: string, to: string) {
  let cost = 0;
  let leads = 0;
  let clicks = 0;
  let impressions = 0;
  const days: CampaignPoint[] = [];
  for (const point of points) {
    if (point.day < from || point.day > to) continue;
    cost += point.cost;
    leads += point.leads;
    clicks += point.clicks;
    impressions += point.impressions;
    if (point.cost > 0 || point.leads > 0 || point.clicks > 0) days.push(point);
  }
  return {
    cost,
    leads,
    clicks,
    impressions,
    cpl: leads > 0 ? cost / leads : null,
    days,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function phoneDigits(value: string): string | null {
  const compact = value.replace(/[\s\-().]/g, "");
  const normalized = compact.startsWith("+") ? compact.slice(1) : compact;
  if (!/^\d{8,15}$/.test(normalized)) return null;
  if (normalized.startsWith("972")) {
    const local = `0${normalized.slice(3)}`;
    return local.length >= 9 && local.length <= 10 ? local : normalized;
  }
  return normalized.startsWith("0") ? normalized : normalized;
}

function phoneAt(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw !== "string" && typeof raw !== "number") continue;
    const phone = phoneDigits(String(raw));
    if (phone) return phone;
  }
  return null;
}

export function phonesFromCallMetadata(metadata: unknown): {
  caller: string | null;
  dialed: string | null;
} {
  const meta = asRecord(metadata);
  let caller = phoneAt(meta, CALLER_KEYS);
  let dialed = phoneAt(meta, DIALED_KEYS);
  for (const value of Object.values(meta)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const nested = value as Record<string, unknown>;
    caller = caller ?? phoneAt(nested, CALLER_KEYS);
    dialed = dialed ?? phoneAt(nested, DIALED_KEYS);
  }
  if (!caller) {
    const named = meta.customer_name ?? meta.display_name;
    if (typeof named === "string") caller = phoneDigits(named);
  }
  if (caller && dialed && caller === dialed) dialed = null;
  return { caller, dialed };
}
