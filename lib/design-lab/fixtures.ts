import type { DashboardCampaignPulse } from "@/app/actions/dashboard-pulse";
import type { GeneralPlSnapshot } from "@/app/actions/finance-general-pl";
import type { CampaignBoard, CampaignPoint, GoogleCallLine } from "@/lib/campaigns/board";
import { emptyPayContract } from "@/lib/employees/contract";
import type { FinanceEmployee, FinanceEntry, FinanceSupplier } from "@/lib/finance/categories";
import type { LeadControlSnapshot } from "@/lib/lead-control/load";
import type { ControlItem, ControlLane, ControlState } from "@/lib/lead-control/rules";
import type { ShemeshPulse } from "@/lib/shemesh/pulse";
import type {
  AgentStat,
  DashboardData,
  MarketingProduction,
  MarketingSource,
} from "@/lib/sales-dashboard/types";

/**
 * Dev-only picture of a synced agency, dated to the current month so the
 * existing screens have rows, charts, and tables to draw. `source: "live"`
 * matches the guard the control center uses for a saved sync. Nothing here
 * is written to the database.
 */

const AGENTS = ["ניב קובי", "סימונה", "אסף בר און", "בן ביטון", "חן בר און", "אוריאל כהן"];
const PRODUCTS = ["בריאות", "משכנתא", "תאונות", 'אכ"ע', "פנסיה"];
const COMPANIES = ["מגדל", "הראל", "הפניקס", "כלל", "מנורה"];
const SOURCES = ["שיחות נכנסות", "לקוחות ליבה", "קמפיין אישי", "לידים קרים", "רועי אזולאי"];
const CLIENTS = [
  "דנה מזרחי",
  "יוסי דהן",
  "חיים פאטיטיף",
  "תקווה פרץ",
  "מוחמד אבו ראס",
  "ריבה טיטשוולי",
  "נועה ביטון",
  "אביגיל שמש",
  "מאיר אזולאי",
  "שרה כהן",
  "עידו לוי",
  "מירב חדד",
  "יונתן פרץ",
  "הילה אברהם",
  "רון מזרחי",
  "ליאור דהן",
  "ענת ביטון",
  "גיל חדד",
];

function jerusalemYmd(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "01";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function shiftMonth(monthKey: string, delta: number): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function dayIn(monthKey: string, day: number): string {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function monthDays(today: string): string[] {
  const last = Number(today.slice(8, 10));
  const monthKey = today.slice(0, 7);
  return Array.from({ length: last }, (_, index) => dayIn(monthKey, index + 1));
}

function hebrewMonth(monthKey: string): string {
  const names = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצ"];
  const index = Number(monthKey.slice(5, 7)) - 1;
  return `${names[index] ?? monthKey} ${monthKey.slice(0, 4)}`;
}

function production(input: {
  key: string;
  client: string;
  agent: string;
  product: string;
  company: string;
  source: string;
  premium: number;
  status: MarketingProduction["status"];
  statusRaw: string;
  process: string;
  startDate: string;
  transferDate: string;
}): MarketingProduction {
  return {
    ...input,
    fields: {
      "שם לקוח": input.client,
      משווק: input.agent,
      "סוג המוצר": input.product,
      "חברת הביטוח": input.company,
      "מקור הפנייה": input.source,
      פרמיה: String(input.premium),
      "סטאטוס פוליסה": input.statusRaw,
      "סוג תהליך": input.process,
      "תאריך תחילת ביטוח": input.startDate,
      "תאריך העברה ליצרן": input.transferDate,
    },
  };
}

function rollup(rows: MarketingProduction[], pick: (row: MarketingProduction) => string): AgentStat[] {
  const map = new Map<string, AgentStat>();
  for (const row of rows) {
    const name = pick(row) || "—";
    const current = map.get(name) ?? { name, count: 0, sum: 0 };
    current.count += 1;
    current.sum += row.premium;
    map.set(name, current);
  }
  return [...map.values()].sort((a, b) => b.sum - a.sum);
}

export function designLabDashboard(now = new Date()): DashboardData {
  const today = jerusalemYmd(now);
  const monthKey = today.slice(0, 7);
  const nextMonth = shiftMonth(monthKey, 1);
  const upcoming = `${nextMonth}-01`;
  const carried = [1, 2, 3].map((back) => shiftMonth(monthKey, -back));
  const productions: MarketingProduction[] = [];

  const activePlan: [string, string, string, string, number][] = [
    ["ניב קובי", "בריאות", "מגדל", "שיחות נכנסות", 2480],
    ["ניב קובי", "משכנתא", "הראל", "שיחות נכנסות", 3120],
    ["ניב קובי", "בריאות", "הפניקס", "לקוחות ליבה", 1860],
    ["סימונה", "תאונות", "כלל", "קמפיין אישי", 1540],
    ["סימונה", "בריאות", "מגדל", "שיחות נכנסות", 2210],
    ["אסף בר און", "משכנתא", "מנורה", "לידים קרים", 2740],
    ["אסף בר און", 'אכ"ע', "הראל", "רועי אזולאי", 980],
    ["בן ביטון", "פנסיה", "הפניקס", "לקוחות ליבה", 1320],
    ["חן בר און", "בריאות", "כלל", "קמפיין אישי", 1670],
    ["אוריאל כהן", "תאונות", "מגדל", "שיחות נכנסות", 890],
  ];
  activePlan.forEach(([agent, product, company, source, premium], index) => {
    productions.push(
      production({
        key: `lab-active-${index}`,
        client: CLIENTS[index % CLIENTS.length],
        agent,
        product,
        company,
        source,
        premium,
        status: "active",
        statusRaw: "פעילה",
        process: "מכירה",
        startDate: dayIn(monthKey, 2 + index * 2),
        transferDate: dayIn(monthKey, 1 + index * 2),
      }),
    );
  });

  const pendingPlan: [string, string, number][] = [
    ["אוריאל כהן", "משכנתא", 1450],
    ["ניב קובי", "תאונות", 760],
    ["סימונה", "בריאות", 1180],
    ["בן ביטון", "פנסיה", 640],
  ];
  pendingPlan.forEach(([agent, product, premium], index) => {
    productions.push(
      production({
        key: `lab-pending-${index}`,
        client: CLIENTS[(index + 6) % CLIENTS.length],
        agent,
        product,
        company: COMPANIES[index % COMPANIES.length],
        source: SOURCES[(index + 1) % SOURCES.length],
        premium,
        status: "pending",
        statusRaw: "ממתינה למינוי",
        process: "מכירה",
        startDate: "",
        transferDate: dayIn(monthKey, 4 + index * 3),
      }),
    );
  });

  [
    ["חן בר און", "בריאות", 540],
    ["אסף בר און", "תאונות", 410],
  ].forEach(([agent, product, premium], index) => {
    productions.push(
      production({
        key: `lab-cancel-${index}`,
        client: CLIENTS[(index + 10) % CLIENTS.length],
        agent: String(agent),
        product: String(product),
        company: COMPANIES[index],
        source: "לידים קרים",
        premium: Number(premium),
        status: "cancelled",
        statusRaw: "בוטלה",
        process: "מכירה",
        startDate: dayIn(monthKey, 6 + index),
        transferDate: dayIn(monthKey, 5 + index),
      }),
    );
  });

  [
    ["ניב קובי", "בריאות", "מגדל", 2100, monthKey],
    ["סימונה", "משכנתא", "הראל", 1680, monthKey],
    ["אסף בר און", "פנסיה", "כלל", 990, monthKey],
    ["בן ביטון", "בריאות", "הפניקס", 1420, carried[0]],
    ["חן בר און", "תאונות", "מנורה", 870, carried[1]],
  ].forEach(([agent, product, company, premium, transferMonth], index) => {
    productions.push(
      production({
        key: `lab-upcoming-${index}`,
        client: CLIENTS[(index + 12) % CLIENTS.length],
        agent: String(agent),
        product: String(product),
        company: String(company),
        source: SOURCES[index % SOURCES.length],
        premium: Number(premium),
        status: "active",
        statusRaw: "פעילה",
        process: "מכירה",
        startDate: upcoming,
        transferDate: dayIn(String(transferMonth), 8 + index),
      }),
    );
  });

  [
    ["ניב קובי", carried[0], 720],
    ["סימונה", carried[1], 640],
    ["אוריאל כהן", carried[2], 510],
  ].forEach(([agent, transferMonth, premium], index) => {
    productions.push(
      production({
        key: `lab-carried-${index}`,
        client: CLIENTS[(index + 3) % CLIENTS.length],
        agent: String(agent),
        product: PRODUCTS[index],
        company: COMPANIES[index],
        source: SOURCES[index],
        premium: Number(premium),
        status: "pending",
        statusRaw: "ממתינה למינוי",
        process: "מכירה",
        startDate: "",
        transferDate: dayIn(String(transferMonth), 12),
      }),
    );
  });

  [
    ["ניב קובי", 1860],
    ["סימונה", 1240],
    ["אסף בר און", 980],
    ["בן ביטון", 760],
    ["אוריאל כהן", 540],
  ].forEach(([agent, premium], index) => {
    productions.push(
      production({
        key: `lab-appoint-${index}`,
        client: CLIENTS[(index + 8) % CLIENTS.length],
        agent: String(agent),
        product: "מינוי סוכן",
        company: COMPANIES[index % COMPANIES.length],
        source: "לקוחות ליבה",
        premium: Number(premium),
        status: "active",
        statusRaw: "פעילה",
        process: "מינוי סוכן",
        startDate: dayIn(monthKey, 3 + index),
        transferDate: dayIn(monthKey, 3 + index),
      }),
    );
  });

  const salesRows = productions.filter((row) => row.process === "מכירה" && row.status !== "cancelled");
  const monthLabels = Array.from({ length: 8 }, (_, index) => hebrewMonth(shiftMonth(monthKey, index - 7)));
  const counts = [48, 61, 57, 73, 69, 84, 78, salesRows.length];
  const sums = counts.map((count, index) => count * (1680 + index * 40));
  const agents = rollup(salesRows, (row) => row.agent);
  const sources = rollup(
    productions.filter((row) => row.status === "active"),
    (row) => row.source,
  ).map((row) => ({ name: row.name, count: row.count }));

  const bySource = new Map<string, MarketingSource>();
  for (const row of productions) {
    const current = bySource.get(row.source) ?? {
      name: row.source,
      activeCount: 0,
      activePremium: 0,
      pendingCount: 0,
      pendingPremium: 0,
      agents: [],
      months: [],
      products: [],
      companies: [],
    };
    if (row.status === "active") {
      current.activeCount += 1;
      current.activePremium += row.premium;
    }
    if (row.status === "pending") {
      current.pendingCount += 1;
      current.pendingPremium += row.premium;
    }
    bySource.set(row.source, current);
  }

  return {
    active: productions.filter((row) => row.status === "active").length,
    premium: productions.filter((row) => row.status === "active").reduce((sum, row) => sum + row.premium, 0),
    pending: productions.filter((row) => row.status === "pending").length,
    issues: productions.filter((row) => row.status === "cancelled").length,
    agents,
    monthAgents: agents,
    companies: rollup(productions, (row) => row.company).map((row) => ({ name: row.name, count: row.count })),
    sources,
    sales: { labels: monthLabels, counts, sums },
    appointments: {
      labels: monthLabels,
      counts: [6, 9, 8, 11, 10, 12, 9, 5],
      sums: [4200, 6100, 5400, 7800, 6900, 8400, 6200, 5380],
    },
    currentMonth: {
      label: hebrewMonth(monthKey),
      totalCount: salesRows.length,
      totalSum: salesRows.reduce((sum, row) => sum + row.premium, 0),
      activeCount: productions.filter((row) => row.status === "active" && row.process === "מכירה").length,
      activeSum: productions
        .filter((row) => row.status === "active" && row.process === "מכירה")
        .reduce((sum, row) => sum + row.premium, 0),
    },
    pendingRows: productions
      .filter((row) => row.status === "pending")
      .map((row) => ({
        name: row.client,
        agent: row.agent,
        product: row.product,
        premium: row.premium,
        date: row.transferDate,
      })),
    activePolicies: productions
      .filter((row) => row.status === "active")
      .slice(0, 8)
      .map((row) => ({
        key: row.key,
        client: row.client,
        product: row.product,
        company: row.company,
        premium: row.premium,
        agent: row.agent,
      })),
    marketing: {
      activeCount: productions.filter((row) => row.status === "active").length,
      activePremium: productions.filter((row) => row.status === "active").reduce((sum, row) => sum + row.premium, 0),
      pendingCount: productions.filter((row) => row.status === "pending").length,
      pendingPremium: productions.filter((row) => row.status === "pending").reduce((sum, row) => sum + row.premium, 0),
      cancelledCount: productions.filter((row) => row.status === "cancelled").length,
      cancelledPremium: productions.filter((row) => row.status === "cancelled").reduce((sum, row) => sum + row.premium, 0),
      sources: [...bySource.values()],
      sourceCatalog: SOURCES,
      sellerCatalog: AGENTS,
      excelHeaders: ["שם לקוח", "משווק", "סוג המוצר", "חברת הביטוח", "מקור הפנייה", "פרמיה", "סטאטוס פוליסה"],
      productions,
      agents,
      months: monthLabels.map((name, index) => ({ name, count: counts[index], sum: sums[index] })),
      products: rollup(productions, (row) => row.product),
      companies: rollup(productions, (row) => row.company),
    },
    fileName: "דוח מנהלים — הדגמה.xlsx",
    syncedAt: now.toISOString(),
    source: "live",
  };
}

export function designLabCampaignPulse(now = new Date()): DashboardCampaignPulse {
  const today = jerusalemYmd(now);
  return {
    from: `${today.slice(0, 7)}-01`,
    to: today,
    today,
    spend: 18420,
    googleSpend: 11240,
    facebookSpend: 7180,
    googleCalls: 86,
    facebookForms: 41,
    todaySpend: 640,
    todayGoogleCalls: 4,
    todayFacebookForms: 2,
    googleSyncedAt: now.toISOString(),
    facebookSyncedAt: now.toISOString(),
  };
}

function wavePoints(days: string[], seed: number): CampaignPoint[] {
  return days.map((day, index) => {
    const weekend = new Date(`${day}T12:00:00Z`).getUTCDay();
    const quiet = weekend === 5 || weekend === 6 ? 0.45 : 1;
    const leads = Math.max(0, Math.round((1 + ((index + seed) % 4)) * quiet));
    const cost = Math.round((420 + seed * 55 + (index % 5) * 70) * quiet);
    return {
      day,
      cost,
      leads,
      clicks: leads * 7 + 4 + (index % 3),
      impressions: cost * 4 + seed * 20,
    };
  });
}

export function designLabCampaigns(now = new Date()): CampaignBoard {
  const today = jerusalemYmd(now);
  const days = monthDays(today);
  const historyFrom = shiftMonth(today.slice(0, 7), -2) + "-01";
  const googleCalls: GoogleCallLine[] = [
    ["09:12", 186, "RECEIVED", "ביטוחים — שיחות נכנסות", "מרכז", "שיחה", "אתר"],
    ["10:41", 74, "RECEIVED", "ביטוחים — חידושים", "צפון", "שיחה", "אתר"],
    ["11:05", 0, "MISSED", "ביטוחים — שיחות נכנסות", "שרון", "שיחה", "מודעה"],
    ["13:22", 240, "RECEIVED", "ביטוחים — לידים קרים", "דרום", "שיחה", "אתר"],
    ["15:48", 96, "RECEIVED", "ביטוחים — שיחות נכנסות", "מרכז", "שיחה", "מודעה"],
    ["16:10", 0, "MISSED", "ביטוחים — חידושים", "ירושלים", "שיחה", "אתר"],
  ].map(([time, duration, status, campaign, area, kind, place], index) => {
    const day = days[Math.max(0, days.length - 1 - (index % 3))];
    return {
      at: `${day}T${time}:00`,
      day,
      time: String(time),
      durationSec: Number(duration),
      status: String(status),
      campaignName: String(campaign),
      area: String(area),
      kind: String(kind),
      place: String(place),
    };
  });

  return {
    today,
    historyFrom,
    canSync: false,
    google: {
      connected: true,
      lastSyncedAt: now.toISOString(),
      lastError: null,
      campaigns: [
        ["g-calls", "ביטוחים — שיחות נכנסות", 3],
        ["g-renew", "ביטוחים — חידושים", 2],
        ["g-cold", "ביטוחים — לידים קרים", 1],
      ].map(([id, name, seed]) => ({
        id: String(id),
        name: String(name),
        status: "ENABLED",
        active: true,
        sourceName: "שיחות נכנסות",
        inbound: true,
        points: wavePoints(days, Number(seed)),
      })),
    },
    facebook: {
      connected: true,
      lastSyncedAt: now.toISOString(),
      lastError: null,
      campaigns: [
        ["f-health", "ליבה — בריאות", "חשבון ליבה"],
        ["f-home", "ליבה — משכנתא", "חשבון ליבה"],
      ].map(([id, name, account], index) => ({
        id,
        name,
        status: "ACTIVE",
        active: true,
        sourceName: "פייסבוק",
        adAccountId: "act-liba",
        adAccountName: account,
        inbound: false,
        points: wavePoints(days, index + 4),
      })),
    },
    calls: {
      days: days.slice(-7).map((day, index) => ({ day, count: 6 + index, durationSec: 900 + index * 120 })),
      phones: [],
      truncated: false,
    },
    googleCalls,
    googleCallsError: null,
  };
}

function lead(input: {
  id: string;
  kind: "lead" | "workflow";
  number: number;
  name: string;
  status: string;
  assignee: string;
  source: string;
  lane: ControlLane;
  rule: string;
  openedHoursAgo: number;
  deadlineHours: number | null;
  state: ControlState;
  now: number;
}): ControlItem {
  const opened = input.now - input.openedHoursAgo * 3_600_000;
  const deadline = input.deadlineHours == null ? null : new Date(input.now + input.deadlineHours * 3_600_000).toISOString();
  return {
    id: input.id,
    kind: input.kind,
    number: input.number,
    name: input.name,
    status: input.status,
    assignee: input.assignee,
    source: input.source,
    lane: input.lane,
    rule: input.rule,
    openedAt: new Date(opened).toISOString(),
    deadline,
    state: input.state,
    lateMs: input.state === "overdue" ? Math.abs(input.deadlineHours ?? 1) * 3_600_000 : 0,
  };
}

export function designLabLeads(now = new Date()): LeadControlSnapshot {
  const stamp = now.getTime();
  const items: ControlItem[] = [
    lead({ id: "l1", kind: "lead", number: 18420, name: "דנה מזרחי", status: "חדש", assignee: "ניב קובי", source: "שיחות נכנסות", lane: "leads", rule: "לכל היותר יום", openedHoursAgo: 40, deadlineHours: -16, state: "overdue", now: stamp }),
    lead({ id: "l2", kind: "lead", number: 18421, name: "יוסי דהן", status: "מעקב", assignee: "סימונה", source: "קמפיין אישי", lane: "leads", rule: "לכל היותר יום", openedHoursAgo: 10, deadlineHours: 14, state: "on_time", now: stamp }),
    lead({ id: "l3", kind: "lead", number: 18422, name: "נועה ביטון", status: "חדש", assignee: "", source: "לידים קרים", lane: "leads", rule: "ממתין למטפל", openedHoursAgo: 6, deadlineHours: null, state: "unassigned", now: stamp }),
    lead({ id: "l4", kind: "lead", number: 18423, name: "מאיר אזולאי", status: "הצעת מחיר", assignee: "אסף בר און", source: "רועי אזולאי", lane: "leads", rule: "לכל היותר יום", openedHoursAgo: 30, deadlineHours: -6, state: "overdue", now: stamp }),
    lead({ id: "w1", kind: "workflow", number: 9021, name: "תקווה פרץ", status: "שיקוף חדש", assignee: "סופיה", source: "שיחות נכנסות", lane: "sofia", rule: "לכל היותר יום", openedHoursAgo: 28, deadlineHours: -4, state: "overdue", now: stamp }),
    lead({ id: "w2", kind: "workflow", number: 9022, name: "ריבה טיטשוולי", status: "בקרה לפני שיקוף ליבה", assignee: "משי", source: "לקוחות ליבה", lane: "mashi", rule: "לכל היותר 3 שעות", openedHoursAgo: 5, deadlineHours: -2, state: "overdue", now: stamp }),
    lead({ id: "w3", kind: "workflow", number: 9023, name: "עידו לוי", status: "לשלוח הצעה להפקה", assignee: "משי", source: "קמפיין אישי", lane: "mashi", rule: "לכל היותר 3 שעות", openedHoursAgo: 1, deadlineHours: 2, state: "on_time", now: stamp }),
    lead({ id: "w4", kind: "workflow", number: 9024, name: "מירב חדד", status: "נשלחה הפקה חדשה", assignee: "משי", source: "שיחות נכנסות", lane: "mashi", rule: "נשלח, בלי שעון איחור", openedHoursAgo: 8, deadlineHours: null, state: "watching", now: stamp }),
    lead({ id: "w5", kind: "workflow", number: 9025, name: "שרה כהן", status: "חוסרים מהחברה", assignee: "אוריאל כהן", source: "הראל", lane: "rep", rule: "לכל היותר יום", openedHoursAgo: 36, deadlineHours: -12, state: "overdue", now: stamp }),
    lead({ id: "w6", kind: "workflow", number: 9026, name: "גיל חדד", status: "נדרש תנאי חיתום", assignee: "חן בר און", source: "מגדל", lane: "rep", rule: "בטיפול הנציג, בלי שעון", openedHoursAgo: 20, deadlineHours: null, state: "watching", now: stamp }),
    lead({ id: "a1", kind: "workflow", number: 4401, name: "הילה אברהם", status: "מינוי סוכן חדש", assignee: "ניב קובי", source: "לקוחות ליבה", lane: "appointment", rule: "לכל היותר יום", openedHoursAgo: 18, deadlineHours: 6, state: "on_time", now: stamp }),
    lead({ id: "a2", kind: "workflow", number: 4402, name: "רון מזרחי", status: "ריגקט חברה", assignee: "בן ביטון", source: "כלל", lane: "appointment", rule: "ריג'קט, השעון עצור", openedHoursAgo: 50, deadlineHours: null, state: "blocked", now: stamp }),
  ];
  return {
    fetchedAt: now.toISOString(),
    configured: true,
    error: null,
    truncated: false,
    items,
  };
}

export function designLabShemesh(now = new Date()): ShemeshPulse {
  const today = jerusalemYmd(now);
  const days = monthDays(today);
  const agents = ["ניב - שמש", "שמש", "חן בר און"];
  return {
    googleSyncedAt: now.toISOString(),
    facebookSyncedAt: now.toISOString(),
    excelSyncedAt: now.toISOString(),
    campaigns: [
      {
        id: "s-g",
        name: "פיננסים — שיחות",
        channel: "google",
        active: true,
        days: days.map((day, index) => ({ day, cost: 280 + (index % 4) * 40, leads: index % 3 === 0 ? 2 : 1 })),
      },
      {
        id: "s-f",
        name: "פיננסים — טפסים",
        channel: "facebook",
        active: true,
        days: days.map((day, index) => ({ day, cost: 190 + (index % 5) * 25, leads: index % 2 })),
      },
      {
        id: "s-g2",
        name: "פיננסים — חידוש",
        channel: "google",
        active: true,
        days: days.slice(-10).map((day, index) => ({ day, cost: 150 + index * 12, leads: 1 })),
      },
    ],
    collection: [
      { day: days[2] ?? today, status: "פתוח", agent: agents[0], source: "גוגל", deal: 8200, collected: 4100 },
      { day: days[6] ?? today, status: "פתוח", agent: agents[1], source: "פייסבוק", deal: 6400, collected: 6400 },
      { day: days[9] ?? today, status: "פתוח", agent: agents[0], source: "גוגל", deal: 9100, collected: 2500 },
      { day: days[14] ?? today, status: "בוטל", agent: agents[2], source: "גוגל", deal: 1800, collected: 0 },
      { day: days[Math.max(0, days.length - 2)], status: "פתוח", agent: agents[1], source: "פייסבוק", deal: 4700, collected: 1200 },
    ],
    invoices: [
      { day: days[4] ?? today, agent: agents[0], amount: 2400, net: 2040, reward: 720 },
      { day: days[11] ?? today, agent: agents[1], amount: 1800, net: 1530, reward: 540 },
      { day: days[Math.max(0, days.length - 3)], agent: agents[2], amount: 960, net: 816, reward: 280 },
    ],
    finance: { commission: 18600, settled: 12400, rows: 5 },
  };
}

export function designLabPl(now = new Date()): GeneralPlSnapshot {
  const today = jerusalemYmd(now);
  const from = `${today.slice(0, 4)}-01-01`;
  return {
    preset: "ytd",
    from,
    to: today,
    periodLabel: "מתחילת השנה",
    rangeDisplay: `${from} – ${today}`,
    excel: {
      incomeNote: "לפי הסכמי חברות הביטוח שבמערכת",
      agentMultiplierDefault: 1,
      closures: 186,
      premium: 412400,
      income: 128600,
      wageTotal: 74200,
      adsTotal: 38600,
      expenseTotal: 21400,
      net: 128600 - 74200 - 38600 - 21400,
      fixedExpected: 62400,
      netAfterFixed: 128600 - 74200 - 38600 - 21400 - 62400,
      excelAsOf: now.toISOString(),
      error: null,
    },
    fixed: {
      expectedTotal: 62400,
      paidTotal: 41800,
      unpaidCount: 2,
      monthsCovered: Number(today.slice(5, 7)),
      rows: [
        { id: "rent", title: "שכירות משרד", category: "rent", categoryLabel: "שכירות", group: "משרד", expected: 18500, paid: 18500, status: "paid" },
        { id: "power", title: "חשמל וארנונה", category: "utilities", categoryLabel: "שוטף", group: "משרד", expected: 4200, paid: 2800, status: "partial" },
        { id: "software", title: "תוכנות ומערכות", category: "software", categoryLabel: "תוכנה", group: "משרד", expected: 6100, paid: 0, status: "unpaid" },
        { id: "phone", title: "טלפוניה", category: "telecom", categoryLabel: "תקשורת", group: "משרד", expected: 2400, paid: 2400, status: "paid" },
        { id: "clean", title: "ניקיון", category: "office", categoryLabel: "משרד", group: "משרד", expected: 1800, paid: 0, status: "unpaid" },
      ],
    },
  };
}

export function designLabFinance(now = new Date()): {
  entries: FinanceEntry[];
  employees: FinanceEmployee[];
  suppliers: FinanceSupplier[];
  from: string;
  to: string;
} {
  const today = jerusalemYmd(now);
  const month = today.slice(0, 7);
  const stamp = now.toISOString();
  const pay = emptyPayContract();
  const employees: FinanceEmployee[] = ["ניב קובי", "סימונה", "אסף בר און"].map((name, index) => ({
    id: `emp-${index}`,
    full_name: name,
    department: "מכירות",
    short_dial: String(101 + index),
    email: null,
    direct_phone: null,
    outbound_number: null,
    sim_provider: null,
    wait_circle: null,
    dialer_type: null,
    notes: null,
    is_active: true,
    created_at: stamp,
    employment_kind: "freelancer",
    pay_contract: pay,
    agreements: [],
  }));
  const suppliers: FinanceSupplier[] = [
    { id: "sup-1", name: "גוגל", category: "פרסום", phone: null, email: null, contact_name: null, notes: null, is_active: true, created_at: stamp },
    { id: "sup-2", name: "בעל הנכס", category: "שכירות", phone: null, email: null, contact_name: null, notes: null, is_active: true, created_at: stamp },
  ];
  const entries: FinanceEntry[] = [
    ["income", "commission_portal", 18600, "עמלת מגדל — אוקטובר", "emp-0", null],
    ["income", "commission_pension", 9400, "עמלת פנסיה הראל", "emp-1", null],
    ["income", "commission_other", 3200, "החזר עמלה כלל", null, null],
    ["income_adjustment", "commission_clawback", 860, "קיזוז פוליסה שבוטלה", "emp-2", null],
    ["expense", "office_general", 18500, "שכירות משרד", null, "sup-2"],
    ["expense", "salary_gross", 12400, "שכר ניב קובי", "emp-0", null],
    ["expense", "advertising", 11240, "גוגל ביטוחים", null, "sup-1"],
  ].map(([kind, category, amount, description, employee, supplier], index) => ({
    id: `fin-${index}`,
    kind: kind as FinanceEntry["kind"],
    category: String(category),
    amount: Number(amount),
    currency: "ILS",
    occurred_at: `${month}-${String(3 + index * 3).padStart(2, "0")}`,
    portal_slug: kind === "income" ? "migdal" : null,
    commission_type: kind === "income" ? "volume" : null,
    description: String(description),
    reference_number: `LB-${2400 + index}`,
    vat_included: kind !== "expense" || category !== "salary_gross",
    withholding_applied: false,
    notes: null,
    employee_id: employee ? String(employee) : null,
    supplier_id: supplier ? String(supplier) : null,
    payroll_month: category === "salary_gross" ? month : null,
    fixed_cost_id: null,
    created_at: stamp,
    updated_at: stamp,
  }));
  return { entries, employees, suppliers, from: `${month}-01`, to: today };
}
