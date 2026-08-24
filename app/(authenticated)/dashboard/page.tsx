import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpLeft, Bot, CheckCircle2, Circle, LayoutDashboard, TrendingUp, Users } from "lucide-react";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";
import { canAccessSalesDashboard, requireProfile } from "@/lib/auth";
import { agents } from "@/lib/agents.config";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "לוח בקרה",
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const showSalesDashboard = canAccessSalesDashboard(profile);
  const firstName = profile.full_name?.split(/\s+/)[0] || profile.email;
  const initials = getInitials(profile.full_name || profile.email);

  const supabase = createClient();
  // Employees don't need org-wide user counts — skip the extra round-trips.
  const [{ count: userCount }, { count: activeCount }] = isAdmin
    ? await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
      ])
    : [{ count: 1 }, { count: 1 }];

  const usersTotal = userCount ?? 1;
  const usersActive = activeCount ?? 1;
  const agentsTotal = agents.length;
  const modulesReady = 2 + (isAdmin ? 1 : 0) + (showSalesDashboard ? 1 : 0);

  const today = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const loginTime = new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <section className="mx-auto max-w-[72rem] space-y-5">
      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-highlight text-sm font-bold text-black">
              {initials}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{today}</p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
                {firstName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "מנהל מערכת" : "עובד"} · ליבה ביטוח ופנסיוני
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:gap-x-10">
            <Metric
              label="עובדים פעילים"
              value={usersActive}
              total={usersTotal}
              accent
            />
            <Metric label="סוכני AI" value={agentsTotal} total={Math.max(agentsTotal, 1)} />
            <Metric label="מודולים" value={modulesReady} total={modulesReady} />
            <Metric label="משימות פתוחות" value={0} total={0} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <WeeklyChart />

        <div className="app-surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">פעילות אחרונה</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">יומן עבודה פנימי</p>
            </div>
            {isAdmin && (
              <Link
                href="/dashboard/users"
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                לכל העובדים
                <ArrowUpLeft className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-black/[0.05] text-[11px] font-semibold text-muted-foreground">
                  <th className="px-5 py-2.5 text-start font-semibold sm:px-6">פעולה</th>
                  <th className="px-3 py-2.5 text-start font-semibold">מודול</th>
                  <th className="px-3 py-2.5 text-start font-semibold">סטטוס</th>
                  <th className="px-5 py-2.5 text-start font-semibold sm:px-6">שעה</th>
                </tr>
              </thead>
              <tbody>
                <ActivityRow
                  action="התחברות למערכת"
                  module="אימות"
                  status="הושלם"
                  time={loginTime}
                  done
                  zebra
                />
                <ActivityRow
                  action="טעינת לוח בקרה"
                  module="סקירה"
                  status="פעיל"
                  time={loginTime}
                  done
                />
                {agentsTotal === 0 && (
                  <ActivityRow
                    action="סוכן AI ראשון"
                    module="סוכנים"
                    status="ממתין"
                    time="—"
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCard
          href="/agents"
          title="סוכני AI"
          description="כלים חכמים לעבודה שוטפת בסוכנות"
          icon={Bot}
          meta={agentsTotal === 0 ? "אין סוכנים מחוברים" : `${agentsTotal} פעילים`}
        />
        {showSalesDashboard && (
          <ModuleCard
            href="/sales-dashboard"
            title="דשבורד מכירות"
            description="מסך חי מאקסל OneDrive — פוליסות, פרמיה ולידרבורד"
            icon={TrendingUp}
            meta="תצוגה מקדימה"
          />
        )}
        {isAdmin && (
          <ModuleCard
            href="/dashboard/users"
            title="ניהול משתמשים"
            description="הזמנה, תפקידים והרשאות גישה"
            icon={Users}
            meta={`${usersActive} פעילים מתוך ${usersTotal}`}
          />
        )}
        <ModuleCard
          href="/dashboard"
          title="לוח בקרה"
          description="מדדים, פעילות ומודולים במבט אחד"
          icon={LayoutDashboard}
          meta="מסך נוכחי"
          current
        />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  total,
  accent = false,
}: {
  label: string;
  value: number;
  total: number;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
        <span className="text-base font-medium text-black/20">/{total || 0}</span>
      </p>
      {accent && <span className="mt-2 block h-[3px] w-8 rounded-full bg-highlight" />}
    </div>
  );
}

function ActivityRow({
  action,
  module,
  status,
  time,
  done = false,
  zebra = false,
}: {
  action: string;
  module: string;
  status: string;
  time: string;
  done?: boolean;
  zebra?: boolean;
}) {
  return (
    <tr className={cn(zebra && "bg-background/80")}>
      <td className="px-5 py-3.5 font-medium text-foreground sm:px-6">{action}</td>
      <td className="px-3 py-3.5 text-muted-foreground">{module}</td>
      <td className="px-3 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          {done ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Circle className="h-3.5 w-3.5 text-black/25" />
          )}
          {status}
        </span>
      </td>
      <td className="px-5 py-3.5 tabular-nums text-muted-foreground sm:px-6">{time}</td>
    </tr>
  );
}

function ModuleCard({
  href,
  title,
  description,
  icon: Icon,
  meta,
  current = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  meta: string;
  current?: boolean;
}) {
  return (
    <Link
      href={href}
      className="app-surface group block p-5 transition-colors hover:bg-background/40"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
          <Icon className="h-4 w-4 text-black/70" />
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">{meta}</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      {current && (
        <span className="mt-3 inline-block h-1 w-8 rounded-full bg-highlight" />
      )}
    </Link>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ל";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
