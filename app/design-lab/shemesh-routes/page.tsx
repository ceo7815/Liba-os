import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  BadgeDollarSign,
  Bell,
  Cable,
  ClipboardList,
  FileText,
  Megaphone,
  Scale,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { Aurora } from "@/components/brand/aurora";
import { ShemeshMobileDock } from "@/components/shemesh/mobile-dock";
import { ShemeshTopbar } from "@/components/shemesh/topbar";
import { ShemeshSidebar } from "@/components/shemesh/nav";
import { ShemeshDashboard } from "@/components/shemesh/dashboard-screen";
import { ShemeshPulseProvider } from "@/components/shemesh/pulse-context";
import { ShemeshSourceProvider } from "@/components/shemesh/source-context";
import { ModulePage } from "@/components/shemesh/module-shell";
import { ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { ShemeshEmpty } from "@/components/shemesh/empty-state";
import { GviyaScreen } from "@/components/shemesh/gviya-screen";
import { ShemeshMarketingReport } from "@/components/shemesh/marketing-report";
import { FixedCostsScreen } from "@/components/shemesh/costs-screen";
import { SettlementScreen } from "@/components/shemesh/settlement-screen";
import { ShemeshReports } from "@/components/shemesh/reports-screen";
import { ShemeshSources } from "@/components/shemesh/sources-screen";
import { TaxRefundsScreen } from "@/components/shemesh/tax-refunds-screen";
import { ShemeshFilters } from "@/components/shemesh/filters";
import {
  designLabShemesh,
  designLabShemeshDashboard,
} from "@/lib/design-lab/fixtures";
import { PERMISSION_KEYS } from "@/lib/permissions/catalog";
import type { Profile } from "@/lib/types";
import type { ShemeshSourceStatus } from "@/lib/shemesh/connectors/types";

export const dynamic = "force-dynamic";

const previewProfile: Profile = {
  id: "design-lab",
  email: "preview@liba.invalid",
  full_name: "מנהל הדגמה",
  role: "admin",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  permissionKeys: [...PERMISSION_KEYS],
};

const PREVIEW_SOURCES: ShemeshSourceStatus[] = [
  {
    id: "shared_folder",
    label: "תיקיית OneDrive של שמש",
    pulls: "דוח מכירות שמש פדיונות ראשי",
    connection: "credentials_present",
    lastSyncedAt: "21.10.2026, 13:00",
    message: "מחובר ומסונכרן.",
  },
  {
    id: "facebook_ads",
    label: "פייסבוק מודעות",
    pulls: "קמפיינים של שמש",
    connection: "awaiting_access",
    lastSyncedAt: null,
    message: "ממתין לחיבור.",
  },
];

const ROUTES = [
  "dashboard",
  "cases",
  "gviya",
  "reports",
  "marketing",
  "costs",
  "settlement",
  "sources",
  "tax-refunds",
  "insurance",
  "payroll",
  "sales",
  "clients",
  "alerts",
  "finance",
  "revenue",
  "bank",
  "leads",
  "formulas",
  "settings",
  "agency",
  "expenses",
  "receipts",
  "revival",
  "commercial",
  "commissions",
  "income",
  "access",
  "accountant",
  "ad-receipts",
  "permissions",
  "portfolio-report",
  "system",
] as const;

type RouteId = (typeof ROUTES)[number];

function ShellPage({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
}) {
  return (
    <ShemeshPage
      title={title}
      description={description}
      icon={Icon}
      filters={<ShemeshFilters showPlatform showIncome />}
      stats={
        <>
          <Stat label="אריח ראשון" value="₪ 13,050" />
          <Stat label="אריח שני" value="42" />
          <Stat label="אריח שלישי" value="ממתין" />
        </>
      }
    >
      <ShemeshEmpty icon={Icon} title="תצוגת מובייל" body="מסך לבדיקת התאמה לרוחב המכשיר בלי שינוי נתונים." />
      <div className="glass min-w-0 px-3 py-3 sm:px-5">
        <p className="break-words text-sm">
          שם קובץ ארוך לבדיקה: דוח מכירות שמש פדיונות ראשי.xlsx · סנכרון ישן מיומיים.
        </p>
        <div className="mt-3 max-h-40 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="px-2 py-1 text-right">לקוח</th>
                <th className="px-2 py-1 text-right">סכום</th>
                <th className="px-2 py-1 text-right">סטטוס</th>
                <th className="px-2 py-1 text-right">הערה</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-2 py-2">מיכל כהן</td>
                <td className="px-2 py-2 tabular-nums">1,200</td>
                <td className="px-2 py-2">פתוח</td>
                <td className="px-2 py-2">בדיקת גלילה אופקית בתוך הקופסה</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ShemeshPage>
  );
}

function Screen({ route }: { route: RouteId }) {
  const now = new Date();
  if (route === "dashboard") {
    const dash = designLabShemeshDashboard(now);
    return <ShemeshDashboard input={dash.input} sourceOptions={[...dash.sourceOptions, "מקור עם שם ארוך מאוד לבדיקת רוחב"]} />;
  }
  if (route === "gviya") {
    return (
      <GviyaScreen
        fileName="דוח מכירות שמש פדיונות ראשי.xlsx"
        syncedAt="2026-10-21T10:00:00.000Z"
        deals={[]}
        contacts={[]}
        reps={[]}
        sources={["פייסבוק", "גוגל", "הפניה ארוכה מאוד לבדיקת גלישה"]}
        surenseError={null}
        surenseConfigured={false}
        scanned={0}
      />
    );
  }
  if (route === "marketing") {
    return <ShemeshMarketingReport accountId="2542541459538449" error={null} rows={[]} />;
  }
  if (route === "costs") return <FixedCostsScreen />;
  if (route === "settlement") return <SettlementScreen />;
  if (route === "reports") return <ShemeshReports />;
  if (route === "sources") return <ShemeshSources />;
  if (route === "tax-refunds") {
    return <TaxRefundsScreen fileName={null} rows={[]} statuses={[]} />;
  }
  if (route === "insurance") {
    return (
      <ModulePage
        title="ביטוח"
        description="ייבוא פרמיות ונפרע לפי חברה."
        icon={Shield}
        emptyTitle="אין שורות ביטוח"
        emptyBody="העלו CSV של חברה, נציג, פרמיה ונפרע."
      >
        <div />
      </ModulePage>
    );
  }
  if (route === "payroll") {
    return (
      <ModulePage
        title="שכר"
        description="חישוב מקומי לפי פרופיל."
        icon={Wallet}
        emptyTitle="אין פרופילי שכר"
        emptyBody="השיעורים מוקלדים במסך לחישוב מקומי."
      >
        <div />
      </ModulePage>
    );
  }

  const titles: Record<string, { title: string; description: string; icon: typeof FileText }> = {
    cases: { title: "תיקים", description: "לוח תיקים ושלבים.", icon: ClipboardList },
    sales: { title: "מכירות", description: "שורות מדוח המכירות של שמש.", icon: BadgeDollarSign },
    clients: { title: "לקוחות", description: "כרטיסי לקוח ותיקים.", icon: Users },
    alerts: { title: "התראות", description: "חריגות וסנכרון.", icon: Bell },
    finance: { title: "כספים", description: "ספר וקופה.", icon: Wallet },
    revenue: { title: "הכנסות", description: "גבייה וחשבוניות מהקובץ.", icon: Wallet },
    bank: { title: "בנק", description: "ייבוא תנועות והתאמה.", icon: Cable },
    leads: { title: "לידים", description: "לידים מקמפיינים.", icon: Megaphone },
    formulas: { title: "נוסחאות", description: "שיעורים ומכפילים.", icon: Scale },
    settings: { title: "הגדרות", description: "הגדרות שמש.", icon: Settings },
    agency: { title: "סוכנות", description: "נתוני סוכנות.", icon: FileText },
    expenses: { title: "הוצאות", description: "הוצאות שוטפות.", icon: Wallet },
    receipts: { title: "קבלות", description: "ארכיון קבלות.", icon: FileText },
    revival: { title: "החייאה", description: "החייאת לידים.", icon: Megaphone },
    commercial: { title: "מסחרי", description: "מסחרי וקמפיינים.", icon: Megaphone },
    commissions: { title: "עמלות", description: "עמלות שמש.", icon: BadgeDollarSign },
    income: { title: "הכנסה", description: "הכנסות רשומות.", icon: Wallet },
    access: { title: "יומן גישה", description: "פעולות במערכת.", icon: FileText },
    accountant: { title: "רואה חשבון", description: "טיוטות לרואה החשבון.", icon: FileText },
    "ad-receipts": { title: "קבלות פרסום", description: "קבלות תקציב פרסום.", icon: FileText },
    permissions: { title: "הרשאות", description: "גישות לשמש.", icon: Shield },
    "portfolio-report": { title: "דוח תיק", description: "הפקת דוח תיק.", icon: FileText },
    system: { title: "מערכת", description: "מצב מערכת.", icon: Settings },
  };
  const meta = titles[route];
  if (!meta) return null;
  return <ShellPage title={meta.title} description={meta.description} icon={meta.icon} />;
}

/** Local visual preview of Shemesh routes for mobile overflow checks. Production 404. */
export default function ShemeshRoutesLabPage({
  searchParams,
}: {
  searchParams?: { r?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const route = (searchParams?.r || "dashboard") as RouteId;
  if (!ROUTES.includes(route)) notFound();

  return (
    <div className="shemesh-os os-mesh flex h-dvh min-h-0 overflow-hidden bg-background">
      <Aurora tone="shemesh" />
      <ShemeshPulseProvider pulse={designLabShemesh(new Date())}>
        <ShemeshSourceProvider sources={PREVIEW_SOURCES}>
          <Suspense fallback={null}>
            <ShemeshSidebar className="hidden lg:flex" />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <ShemeshTopbar profile={previewProfile} />
              <div className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto px-3 py-4 sm:px-6">
                <Screen route={route} />
              </div>
              <ShemeshMobileDock />
            </div>
          </Suspense>
        </ShemeshSourceProvider>
      </ShemeshPulseProvider>
    </div>
  );
}
