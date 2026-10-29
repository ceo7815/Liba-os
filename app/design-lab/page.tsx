import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Contact, Wallet } from "lucide-react";
import AgentsPage from "@/app/(authenticated)/agents/page";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { AcademyDashboardScreen } from "@/components/academy/academy-dashboard";
import { ControlCenterScreen } from "@/components/dashboard/control-center-screen";
import { DashHero } from "@/components/dashboard/dash-hero";
import { EmployeesPageClient } from "@/components/employees/employees-page-client";
import { PayrollScreen } from "@/components/employees/payroll-screen";
import { ExpensesScreen } from "@/components/finance/expenses-screen";
import { FinancePanel } from "@/components/finance/finance-panel";
import { GeneralPlScreen } from "@/components/finance/general-pl-screen";
import { InsuranceAgreementsScreen } from "@/components/finance/insurance-agreements-screen";
import { CampaignsScreen } from "@/components/campaigns/campaigns-screen";
import { InterfacesScreen } from "@/components/interfaces/interfaces-screen";
import { LeadControlScreen } from "@/components/lead-control/screen";
import { AppShell } from "@/components/layout/app-shell";
import type { OsModule } from "@/components/layout/shell-frame";
import { SalesBySourceScreen } from "@/components/sales-dashboard/sales-by-source-screen";
import { SalesExcelReportScreen } from "@/components/sales-dashboard/sales-excel-report-screen";
import { Aurora } from "@/components/brand/aurora";
import { ShemeshMobileDock } from "@/components/shemesh/mobile-dock";
import { ShemeshTopbar } from "@/components/shemesh/topbar";
import { ShemeshSidebar } from "@/components/shemesh/nav";
import { ShemeshDashboard } from "@/components/shemesh/dashboard-screen";
import { ShemeshExpenses } from "@/components/shemesh/expenses-screen";
import { ShemeshLeads } from "@/components/shemesh/leads-screen";
import { ShemeshPulseProvider } from "@/components/shemesh/pulse-context";
import { ShemeshReports } from "@/components/shemesh/reports-screen";
import { ShemeshRevenue } from "@/components/shemesh/revenue-screen";
import { ShemeshSourceProvider } from "@/components/shemesh/source-context";
import { ShemeshSources } from "@/components/shemesh/sources-screen";
import { UsersAccessScreen } from "@/components/users/users-access-screen";
import { IconBadge } from "@/components/ui/icon-badge";
import {
  designLabAcademy,
  designLabCampaignPulse,
  designLabCampaigns,
  designLabDashboard,
  designLabExpenses,
  designLabFinance,
  designLabInterfaces,
  designLabLeads,
  designLabPeople,
  designLabPl,
  designLabShemesh,
  designLabShemeshSources,
  designLabShemeshWorkbook,
  designLabUsers,
  designLabWorkbook,
} from "@/lib/design-lab/fixtures";
import { formatIls } from "@/lib/finance/categories";
import { PERMISSION_KEYS } from "@/lib/permissions/catalog";
import type { ShemeshSourceStatus } from "@/lib/shemesh/connectors/types";
import type { Profile } from "@/lib/types";

const previewProfile: Profile = {
  id: "design-lab",
  email: "preview@liba.invalid",
  full_name: "מנהל הדגמה",
  role: "admin",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  permissionKeys: [...PERMISSION_KEYS],
};

function moduleFor(view?: string): OsModule {
  if (view === "leads") return "leads";
  if (view === "campaigns") return "campaigns";
  if (view === "funnel" || view === "sales-rows") return "sales";
  if (view === "finance" || view === "pl" || view === "expenses" || view === "insurance") return "finance";
  if (view === "employees" || view === "payroll") return "people";
  if (view === "academy") return "academy";
  if (view === "agents" || view === "users" || view === "settings") return "system";
  return "dashboard";
}

function ShemeshLab({
  now,
  sources,
  children,
  flush = false,
}: {
  now: Date;
  sources?: ShemeshSourceStatus[];
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div className="shemesh-os os-mesh flex h-dvh min-h-0 overflow-hidden bg-background">
      <Aurora tone="shemesh" />
      <ShemeshPulseProvider pulse={designLabShemesh(now)}>
        <Suspense fallback={null}>
          <ShemeshSidebar className="hidden lg:flex" />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ShemeshTopbar profile={previewProfile} />
            <div className={flush ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"}>
              <ShemeshSourceProvider sources={sources ?? designLabShemeshSources(now)}>
                {children}
              </ShemeshSourceProvider>
            </div>
            <ShemeshMobileDock />
          </div>
        </Suspense>
      </ShemeshPulseProvider>
    </div>
  );
}

/** Local visual preview of the shell. Production builds return 404. */
export default function DesignLabPage({
  searchParams,
}: {
  searchParams?: { view?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const now = new Date();
  const view = searchParams?.view;
  const today = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  if (view === "login" || view === "login-shemesh") {
    const shemesh = view === "login-shemesh";
    return (
      <AuthCard
        brand={shemesh ? "shemesh" : "liba"}
        title={shemesh ? "התחברות לשמש" : "התחברות לליבה"}
        description={
          shemesh
            ? "גישה מאובטחת למערכת של שמש"
            : "גישה מאובטחת לפלטפורמת הניהול הפנימית של ליבה"
        }
        footer={shemesh ? "© שמש · מערכת פנימית" : "© ליבה ביטוח ופנסיוני · מערכת פנימית"}
      >
        <LoginForm redirectTo={shemesh ? "/shemesh" : "/dashboard"} />
      </AuthCard>
    );
  }

  if (view === "shemesh") {
    return (
      <ShemeshLab now={now}>
        <ShemeshDashboard />
      </ShemeshLab>
    );
  }

  if (view === "shemesh-leads") {
    return (
      <ShemeshLab now={now}>
        <ShemeshLeads />
      </ShemeshLab>
    );
  }

  if (view === "shemesh-revenue") {
    return (
      <ShemeshLab now={now}>
        <ShemeshRevenue workbook={designLabShemeshWorkbook(now)} />
      </ShemeshLab>
    );
  }

  if (view === "shemesh-expenses") {
    return (
      <ShemeshLab now={now}>
        <ShemeshExpenses />
      </ShemeshLab>
    );
  }

  if (view === "shemesh-reports") {
    return (
      <ShemeshLab now={now}>
        <ShemeshReports />
      </ShemeshLab>
    );
  }

  if (view === "shemesh-sources") {
    return (
      <ShemeshLab now={now}>
        <ShemeshSources openId="google_ads" />
      </ShemeshLab>
    );
  }

  if (view === "shemesh-case" || view === "shemesh-queue") {
    const workbook = designLabShemeshWorkbook(now);
    const queue = view === "shemesh-queue";
    return (
      <ShemeshLab now={now} flush>
        <SalesExcelReportScreen
          initial={workbook}
          company="shemesh"
          frozen
          initialSheet={queue ? "אנשי קשר" : "תפעול"}
          initialRowId={queue ? null : "Tiful-1"}
        />
      </ShemeshLab>
    );
  }

  const finance = view === "finance" ? designLabFinance(now) : null;
  const people = designLabPeople(now);
  const income = finance?.entries.filter((row) => row.kind === "income").reduce((sum, row) => sum + row.amount, 0) ?? 0;
  const adjustments = finance?.entries
    .filter((row) => row.kind === "income_adjustment")
    .reduce((sum, row) => sum + row.amount, 0) ?? 0;
  const expenses = finance?.entries.filter((row) => row.kind === "expense").reduce((sum, row) => sum + row.amount, 0) ?? 0;

  return (
    <AppShell
      profile={previewProfile}
      previewDashboard={designLabDashboard(now)}
      campaignPulse={designLabCampaignPulse(now)}
      module={moduleFor(view)}
    >
      {view === "leads" ? (
        <LeadControlScreen snapshot={designLabLeads(now)} />
      ) : view === "campaigns" ? (
        <CampaignsScreen initial={designLabCampaigns(now)} brand="liba" />
      ) : view === "funnel" ? (
        <SalesBySourceScreen preview />
      ) : view === "sales-rows" ? (
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <SalesExcelReportScreen initial={designLabWorkbook(now)} frozen />
        </div>
      ) : view === "pl" ? (
        <GeneralPlScreen preview={designLabPl(now)} />
      ) : view === "expenses" ? (
        <ExpensesScreen initialFixedCosts={designLabExpenses(now)} preview />
      ) : view === "insurance" ? (
        <InsuranceAgreementsScreen />
      ) : view === "employees" ? (
        <section className="w-full space-y-4">
          <header>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">עובדים · הסכמים ונוכחות</p>
            <div className="mt-1 flex items-center gap-2.5">
              <IconBadge>
                <Contact className="size-5" />
              </IconBadge>
              <h1 className="text-2xl font-semibold tracking-tight">עובדים</h1>
            </div>
          </header>
          <EmployeesPageClient initialEmployees={people} preview />
        </section>
      ) : view === "payroll" ? (
        <section className="w-full space-y-4">
          <header>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">עובדים · משכורות לפי הסכם</p>
            <div className="mt-1 flex items-center gap-2.5">
              <IconBadge>
                <Wallet className="size-5" />
              </IconBadge>
              <h1 className="text-2xl font-semibold tracking-tight">משכורות</h1>
            </div>
          </header>
          <PayrollScreen initialEmployees={people} preview />
        </section>
      ) : view === "academy" ? (
        <AcademyDashboardScreen data={designLabAcademy()} />
      ) : view === "agents" ? (
        <AgentsPage />
      ) : view === "users" ? (
        <UsersAccessScreen users={designLabUsers(now)} currentUserId={previewProfile.id} />
      ) : view === "settings" ? (
        <InterfacesScreen items={designLabInterfaces(now)} />
      ) : view === "finance" && finance ? (
        <section className="data-sheet w-full space-y-6">
          <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">חשבונות ליבה</p>
                <div className="mt-1 flex items-center gap-2.5">
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[#f2f2f4]">
                    <Wallet className="size-5" />
                  </span>
                  <h1 className="text-2xl font-semibold tracking-tight">רישום תנועות</h1>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  תצוגת הדגמה של היומן — הכנסות, קיזוז והוצאות של החודש.
                </p>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
                <FinanceStat label="הכנסות" value={formatIls(income)} />
                <FinanceStat label="ביטולים" value={formatIls(adjustments)} />
                <FinanceStat label="הוצאות" value={formatIls(expenses)} />
                <FinanceStat label="רווח חודשי" value={formatIls(income - adjustments - expenses)} emphasize />
              </div>
            </div>
          </div>
          <FinancePanel
            initialEntries={finance.entries}
            initialEmployees={finance.employees}
            initialSuppliers={finance.suppliers}
            initialFrom={finance.from}
            initialTo={finance.to}
            listError={null}
          />
        </section>
      ) : (
        <section className="w-full space-y-4">
          <DashHero name="מנהל הדגמה" date={today} />
          <ControlCenterScreen />
        </section>
      )}
    </AppShell>
  );
}

function FinanceStat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={emphasize ? "text-sm font-semibold text-foreground" : "text-sm font-semibold tabular-nums"}>{value}</p>
    </div>
  );
}
