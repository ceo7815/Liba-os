import { agents } from "../lib/agents.config";
import { portals } from "../lib/portals.config";

export type SmokeProfile = "main" | "shemesh" | "design" | "all";

export type SmokeRoute = {
  path: string;
  /** Substring or pattern the visible h1 must contain. */
  heading: string | RegExp;
  auth: boolean;
  /** Omit for routes that exist on main. */
  profile?: "shemesh" | "design";
  /** 404 is acceptable (design-lab hides itself in production). */
  allowNotFound?: boolean;
};

const LIBA: SmokeRoute[] = [
  { path: "/", heading: "שלום", auth: true },
  { path: "/dashboard", heading: "שלום", auth: true },
  { path: "/dashboard/users", heading: "ניהול משתמשים", auth: true },
  { path: "/agents", heading: "סוכני AI", auth: true },
  { path: "/agents/social-media/report", heading: /לא ניתן להציג את הדוח|דוח תזמון/, auth: true },
  { path: "/vault", heading: "כספת סיסמאות", auth: true },
  { path: "/organization/formulas", heading: "נוסחאות חישוב", auth: true },
  { path: "/finance", heading: "רישום תנועות", auth: true },
  { path: "/finance/expenses", heading: "הוצאות", auth: true },
  { path: "/finance/fixed-expenses", heading: "הוצאות קבועות", auth: true },
  { path: "/finance/insurance-agreements", heading: "הסכמי ביטוח", auth: true },
  { path: "/finance/pl-general", heading: "רווח והפסד", auth: true },
  { path: "/finance/settled", heading: "נפרעים", auth: true },
  { path: "/finance/source-pnl", heading: "רווח לפי מקור", auth: true },
  { path: "/employees", heading: "עובדים", auth: true },
  { path: "/employees/agreements", heading: "הסכמי עובדים", auth: true },
  { path: "/employees/payroll", heading: "משכורות", auth: true },
  { path: "/sales-dashboard", heading: "שלום", auth: true },
  { path: "/sales-dashboard/by-source", heading: "פילוח מכירות", auth: true },
  { path: "/sales-dashboard/campaigns", heading: "קמפיינים", auth: true },
  { path: "/sales-dashboard/excel", heading: "שורות מכירה", auth: true },
  { path: "/marketing-dashboard", heading: "רווח לפי מקור", auth: true },
  { path: "/lead-control", heading: "בקרת לידים", auth: true },
  { path: "/interfaces", heading: "ממשקים מחוברים", auth: true },
  { path: "/academy", heading: /.+/, auth: true },
  { path: "/academy/catalog", heading: "קטלוג קורסים", auth: true },
  { path: "/academy/manage", heading: "ניהול תוכן", auth: true },
  { path: "/academy/team", heading: "התקדמות צוות", auth: true },
  { path: "/portals", heading: "איחוד פורטלים", auth: true },
  { path: "/sales-tv", heading: "שלום", auth: true },
  { path: "/shemesh", heading: "לוח בקרה", auth: true },
  { path: "/shemesh/expenses", heading: "הוצאות", auth: true },
  { path: "/shemesh/formulas", heading: "נוסחאות שמש", auth: true },
  { path: "/shemesh/leads", heading: "לידים", auth: true },
  { path: "/shemesh/marketing", heading: "קמפיינים", auth: true },
  { path: "/shemesh/portfolio-report", heading: "השוואת תיק", auth: true },
  { path: "/shemesh/reports", heading: "רווח והפסד", auth: true },
  { path: "/shemesh/revenue", heading: "הכנסות", auth: true },
  { path: "/shemesh/sales", heading: "דוח מכירות", auth: true },
  { path: "/shemesh/sources", heading: "מקורות", auth: true },
];

const PUBLIC: SmokeRoute[] = [
  { path: "/login", heading: "בחירת מערכת", auth: false },
  { path: "/forgot-password", heading: "איפוס סיסמה", auth: false },
  { path: "/set-password", heading: "הגדרת סיסמה", auth: false },
  { path: "/r/e2e-invalid", heading: "הקישור לא תקין", auth: false },
];

/** Pages that exist on cursor/shemesh-phase1 and not on main. */
const SHEMESH_EXTRA: SmokeRoute[] = [
  ["לקוחות ותיקים", "/shemesh/clients"],
  ["כרטיס לקוח", "/shemesh/clients/card"],
  ["תיקים", "/shemesh/cases"],
  ["התראות", "/shemesh/alerts"],
  ["פדיונות", "/shemesh/gviya"],
  ["החזרי מס", "/shemesh/tax-refunds"],
  ["ביטוח", "/shemesh/insurance"],
  ["שיווק ומכירות", "/shemesh/commercial"],
  ["החזרת לידים", "/shemesh/revival"],
  ["קבלות פרסום", "/shemesh/ad-receipts"],
  ["כספים", "/shemesh/finance"],
  ["הכנסות חוזרות", "/shemesh/income"],
  ["הוצאות קבועות", "/shemesh/costs"],
  ["חובות", "/shemesh/debts"],
  ["עמלות", "/shemesh/commissions"],
  ["קבלות", "/shemesh/receipts"],
  ["ייבוא בנק", "/shemesh/bank"],
  ["טיוטה לרואה חשבון", "/shemesh/accountant"],
  ["שכר", "/shemesh/payroll"],
  ["התחשבנות מול ליבה", "/shemesh/settlement"],
  ["מערכת", "/shemesh/system"],
  ["שורנס", "/shemesh/agency"],
  ["הגדרות", "/shemesh/settings"],
  ["הרשאות", "/shemesh/permissions"],
  ["יומן גישה", "/shemesh/access"],
].map(([heading, path]) => ({ path, heading, auth: true, profile: "shemesh" as const }));

const DESIGN_EXTRA: SmokeRoute[] = [
  { path: "/design-lab", heading: /.+/, auth: false, profile: "design", allowNotFound: true },
];

export const SMOKE_ROUTES: SmokeRoute[] = [
  ...PUBLIC,
  ...LIBA,
  ...portals.map((portal) => ({
    path: `/portals/${portal.slug}`,
    heading: portal.name,
    auth: true,
  })),
  ...agents.map((agent) => ({
    path: `/agents/${agent.slug}`,
    heading: agent.name,
    auth: true,
  })),
  ...SHEMESH_EXTRA,
  ...DESIGN_EXTRA,
];

export function smokeProfile(): SmokeProfile {
  const value = process.env.E2E_PROFILE?.trim();
  if (value === "shemesh" || value === "design" || value === "all" || value === "main") {
    return value;
  }
  return "main";
}

export function routesForProfile(profile: SmokeProfile = smokeProfile()): SmokeRoute[] {
  return SMOKE_ROUTES.filter((route) => {
    if (!route.profile) return true;
    if (profile === "all") return true;
    return route.profile === profile;
  });
}
