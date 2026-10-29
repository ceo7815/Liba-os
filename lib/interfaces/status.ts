import { createAdminClient } from "@/lib/supabase/admin";
import { envFacebookAccessToken } from "@/lib/facebook-ads/config";
import {
  FACEBOOK_RECONNECT_PATH,
  facebookTokenExpiryWarning,
} from "@/lib/facebook-ads/expiry";
import { envRefreshToken } from "@/lib/google-ads/config";
import { CAMPAIGNS_PATH, SALES_EXCEL_REPORT_PATH } from "@/lib/sales-dashboard/access";
import { LEAD_CONTROL_PATH } from "@/lib/lead-control/rules";
import { surenseConfigured } from "@/lib/surense/client";
import { loadShemeshLinks } from "@/lib/shemesh/connect";

export type ConnectedInterface = {
  id: string;
  name: string;
  description: string;
  href: string;
  connected: boolean;
  syncedAt: string | null;
  note: string | null;
  warning: string | null;
  actionHref: string | null;
  actionLabel: string | null;
  group: "liba" | "shemesh";
};

const CATALOG: Pick<ConnectedInterface, "id" | "name" | "description" | "href">[] = [
  {
    id: "voicenter",
    name: "Voicenter",
    description: "שיחות שיקוף של סופיה נכנסות לבקרת השיחות.",
    href: "/agents/call-control",
  },
  {
    id: "google-ads",
    name: "גוגל אדס",
    description: "הוצאות ולידים מהקמפיינים בגוגל.",
    href: CAMPAIGNS_PATH,
  },
  {
    id: "facebook",
    name: "פייסבוק",
    description: "הוצאות ולידים מהקמפיינים בפייסבוק.",
    href: CAMPAIGNS_PATH,
  },
  {
    id: "sales-excel",
    name: "דוח אקסל מכירות",
    description: "דוח המנהלים המסונכרן. ממנו נספרות המכירות וההפקות.",
    href: SALES_EXCEL_REPORT_PATH,
  },
  {
    id: "surense",
    name: "שורנס",
    description: "לידים, תהליכים ומינוי סוכן נכנסים לבקרת הלידים.",
    href: LEAD_CONTROL_PATH,
  },
];

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function loadConnectedInterfaces(): Promise<ConnectedInterface[]> {
  const admin = createAdminClient();
  const [google, facebook, workbook, call, tools, surense] = await Promise.all([
    admin
      .from("google_ads_settings")
      .select("customer_id, connected_email, refresh_token_encrypted, last_synced_at")
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("facebook_ads_settings")
      .select(
        "ad_account_name, connected_name, access_token_encrypted, last_synced_at, token_expires_at",
      )
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("sales_excel_workbooks")
      .select("file_name, synced_at, row_count")
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("calls")
      .select("call_date, created_at")
      .eq("source", "voicenter")
      .order("call_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("agent_tools")
      .select("tool_name, status, last_checked_at")
      .ilike("tool_name", "%voicenter%")
      .order("last_checked_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("lead_control_snapshots").select("synced_at").eq("id", 1).maybeSingle(),
  ]);

  const googleRow = google.data;
  const facebookRow = facebook.data;
  const workbookRow = workbook.data;
  const callRow = call.data;
  const toolRow = tools.data;
  const surenseRow = surense.data;

  const googleConnected = Boolean(envRefreshToken() || googleRow?.refresh_token_encrypted);
  const facebookConnected = Boolean(envFacebookAccessToken() || facebookRow?.access_token_encrypted);
  const excelConnected = Boolean(workbookRow?.synced_at);
  const voiceToolConnected = text(toolRow?.status) === "connected";
  const voiceConnected = voiceToolConnected || Boolean(callRow);

  const facebookExpiry = facebookTokenExpiryWarning(
    typeof facebookRow?.token_expires_at === "string" ? facebookRow.token_expires_at : null,
  );

  const byId: Record<
    ConnectedInterface["id"],
    Pick<ConnectedInterface, "connected" | "syncedAt" | "note" | "warning" | "actionHref" | "actionLabel">
  > = {
    voicenter: {
      connected: voiceConnected,
      syncedAt: text(callRow?.call_date) || text(callRow?.created_at) || text(toolRow?.last_checked_at),
      note: voiceConnected ? "שיחות נכנסות" : null,
      warning: null,
      actionHref: null,
      actionLabel: null,
    },
    "google-ads": {
      connected: googleConnected,
      syncedAt: text(googleRow?.last_synced_at),
      note: text(googleRow?.connected_email) || text(googleRow?.customer_id),
      warning: null,
      actionHref: null,
      actionLabel: null,
    },
    facebook: {
      connected: facebookConnected,
      syncedAt: text(facebookRow?.last_synced_at),
      note: text(facebookRow?.ad_account_name) || text(facebookRow?.connected_name),
      warning: facebookConnected ? facebookExpiry : null,
      actionHref: facebookConnected && facebookExpiry ? FACEBOOK_RECONNECT_PATH : null,
      actionLabel: facebookConnected && facebookExpiry ? "חיבור מחדש" : null,
    },
    "sales-excel": {
      connected: excelConnected,
      syncedAt: text(workbookRow?.synced_at),
      note: text(workbookRow?.file_name),
      warning: null,
      actionHref: null,
      actionLabel: null,
    },
    surense: {
      connected: surenseConfigured() || Boolean(surenseRow?.synced_at),
      syncedAt: text(surenseRow?.synced_at),
      note: "Surense",
      warning: null,
      actionHref: null,
      actionLabel: null,
    },
  };

  const liba = CATALOG.map((item) => ({ ...item, ...byId[item.id as keyof typeof byId], group: "liba" as const }));
  const shemesh = await loadShemeshLinks().catch(() => ({ links: [] }));
  const shemeshItems: ConnectedInterface[] = shemesh.links.map((link) => ({
    id: link.id,
    name: link.name,
    description: "חיבור של שמש, בנפרד מהשורה של ליבה.",
    href: link.href,
    connected: link.connected,
    syncedAt: link.syncedAt,
    note: link.note,
    warning: null,
    actionHref: null,
    actionLabel: null,
    group: "shemesh",
  }));
  return [...liba, ...shemeshItems];
}
