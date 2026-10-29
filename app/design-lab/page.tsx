import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { ControlCenterScreen } from "@/components/dashboard/control-center-screen";
import { DashHero } from "@/components/dashboard/dash-hero";
import { FinancePanel } from "@/components/finance/finance-panel";
import { GeneralPlScreen } from "@/components/finance/general-pl-screen";
import { CampaignsScreen } from "@/components/campaigns/campaigns-screen";
import { LeadControlScreen } from "@/components/lead-control/screen";
import { AppShell } from "@/components/layout/app-shell";
import type { OsModule } from "@/components/layout/shell-frame";
import { Aurora } from "@/components/brand/aurora";
import { ShemeshMobileDock } from "@/components/shemesh/mobile-dock";
import { ShemeshTopbar } from "@/components/shemesh/topbar";
import { ShemeshSidebar } from "@/components/shemesh/nav";
import { ShemeshDashboard } from "@/components/shemesh/dashboard-screen";
import { ShemeshPulseProvider } from "@/components/shemesh/pulse-context";
import {
  designLabCampaignPulse,
  designLabCampaigns,
  designLabDashboard,
  designLabFinance,
  designLabLeads,
  designLabPl,
  designLabShemesh,
} from "@/lib/design-lab/fixtures";
import { formatIls } from "@/lib/finance/categories";
import { PERMISSION_KEYS } from "@/lib/permissions/catalog";
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
  if (view === "finance" || view === "pl") return "finance";
  return "dashboard";
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
      <div className="shemesh-os os-mesh flex h-dvh min-h-0 overflow-hidden bg-background">
        <Aurora tone="shemesh" />
        <ShemeshPulseProvider pulse={designLabShemesh(now)}>
          <Suspense fallback={null}>
            <ShemeshSidebar className="hidden lg:flex" />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <ShemeshTopbar profile={previewProfile} />
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                <ShemeshDashboard />
              </div>
              <ShemeshMobileDock />
            </div>
          </Suspense>
        </ShemeshPulseProvider>
      </div>
    );
  }

  const finance = view === "finance" ? designLabFinance(now) : null;
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
      ) : view === "pl" ? (
        <GeneralPlScreen preview={designLabPl(now)} />
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
