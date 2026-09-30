import { createAdminClient } from "@/lib/supabase/admin";
import { envFacebookAccessToken } from "@/lib/facebook-ads/config";
import { envRefreshToken } from "@/lib/google-ads/config";
import { CAMPAIGNS_PATH, SALES_EXCEL_REPORT_PATH } from "@/lib/sales-dashboard/access";

export type ConnectedInterface = {
  id: "voicenter" | "google-ads" | "facebook" | "sales-excel";
  name: string;
  description: string;
  href: string;
  connected: boolean;
  syncedAt: string | null;
  note: string | null;
};

const CATALOG: Omit<ConnectedInterface, "connected" | "syncedAt" | "note">[] = [
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
];

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function loadConnectedInterfaces(): Promise<ConnectedInterface[]> {
  const admin = createAdminClient();
  const [google, facebook, workbook, call, tools] = await Promise.all([
    admin
      .from("google_ads_settings")
      .select("customer_id, connected_email, refresh_token_encrypted, last_synced_at")
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("facebook_ads_settings")
      .select("ad_account_name, connected_name, access_token_encrypted, last_synced_at")
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
  ]);

  const googleRow = google.data;
  const facebookRow = facebook.data;
  const workbookRow = workbook.data;
  const callRow = call.data;
  const toolRow = tools.data;

  const googleConnected = Boolean(envRefreshToken() || googleRow?.refresh_token_encrypted);
  const facebookConnected = Boolean(envFacebookAccessToken() || facebookRow?.access_token_encrypted);
  const excelConnected = Boolean(workbookRow?.synced_at);
  const voiceToolConnected = text(toolRow?.status) === "connected";
  const voiceConnected = voiceToolConnected || Boolean(callRow);

  const byId: Record<ConnectedInterface["id"], Pick<ConnectedInterface, "connected" | "syncedAt" | "note">> = {
    voicenter: {
      connected: voiceConnected,
      syncedAt: text(callRow?.call_date) || text(callRow?.created_at) || text(toolRow?.last_checked_at),
      note: voiceConnected ? "שיחות נכנסות" : null,
    },
    "google-ads": {
      connected: googleConnected,
      syncedAt: text(googleRow?.last_synced_at),
      note: text(googleRow?.connected_email) || text(googleRow?.customer_id),
    },
    facebook: {
      connected: facebookConnected,
      syncedAt: text(facebookRow?.last_synced_at),
      note: text(facebookRow?.ad_account_name) || text(facebookRow?.connected_name),
    },
    "sales-excel": {
      connected: excelConnected,
      syncedAt: text(workbookRow?.synced_at),
      note: text(workbookRow?.file_name),
    },
  };

  return CATALOG.map((item) => ({ ...item, ...byId[item.id] }));
}
