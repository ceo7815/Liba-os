import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpLeft, Bot, ChevronLeft } from "lucide-react";
import { ControlCenterScreen } from "@/components/dashboard/control-center-screen";
import { requireProfile } from "@/lib/auth";
import { canViewAgents } from "@/lib/permissions/access";
import { agents, getAgentStatusLabel } from "@/lib/agents.config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "לוח בקרה",
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  const firstName = profile.full_name?.split(/\s+/)[0] || profile.email;
  const showAgents = canViewAgents(profile);
  const agentRows = showAgents ? agents : [];

  const today = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <section className="mx-auto w-full max-w-[72rem] space-y-4 sm:space-y-6">
      <header className="dash-enter px-0.5 sm:px-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground sm:text-xs">
          {today}
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="text-[1.65rem] font-semibold leading-none tracking-tight sm:text-3xl">
            שלום, {firstName}
          </h1>
          <p className="hidden max-w-[14rem] text-end text-sm leading-snug text-muted-foreground sm:block">
            מצב העסק מהסנכרון האחרון
          </p>
        </div>
      </header>

      <div className="dash-enter" style={{ animationDelay: "60ms" }}>
        <ControlCenterScreen />
      </div>

      {agentRows.length > 0 ? (
        <div
          className="dash-enter overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white sm:rounded-[var(--radius)]"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 sm:px-6 sm:py-3.5">
            <h2 className="text-sm font-semibold">סטטוס סוכנים</h2>
            <Link
              href="/agents"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-black/[0.03] hover:text-foreground active:scale-95"
            >
              הכל
              <ArrowUpLeft className="size-3.5" />
            </Link>
          </div>

          {/* Mobile: tap cards */}
          <ul className="divide-y divide-black/[0.05] sm:hidden">
            {agentRows.map((agent) => (
              <li key={agent.slug}>
                <Link
                  href={agent.href}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-highlight/20"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/35">
                    <Bot className="size-4 text-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {agent.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {agent.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      agent.status === "ready"
                        ? "bg-emerald-100 text-emerald-900"
                        : agent.status === "connecting"
                          ? "bg-amber-100 text-amber-950"
                          : "bg-black/[0.05] text-muted-foreground",
                    )}
                  >
                    {getAgentStatusLabel(agent.status)}
                  </span>
                  <ChevronLeft className="size-4 shrink-0 text-black/25" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-black/[0.05] text-[11px] text-muted-foreground">
                <th className="px-6 py-2.5 text-start font-medium">סוכן</th>
                <th className="px-4 py-2.5 text-start font-medium">תיאור</th>
                <th className="px-6 py-2.5 text-end font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {agentRows.map((agent, idx) => (
                <tr
                  key={agent.slug}
                  className={cn(
                    "border-b border-black/[0.04] transition-colors last:border-b-0 hover:bg-[#fffcf0]/60",
                    idx % 2 === 1 && "bg-background/40",
                  )}
                >
                  <td className="px-6 py-3.5">
                    <Link
                      href={agent.href}
                      className="inline-flex items-center gap-2.5 font-medium hover:underline"
                    >
                      <span className="inline-flex size-8 items-center justify-center rounded-xl bg-highlight/35">
                        <Bot className="size-3.5 text-foreground" />
                      </span>
                      {agent.name}
                    </Link>
                  </td>
                  <td className="max-w-md truncate px-4 py-3.5 text-muted-foreground">
                    {agent.description}
                  </td>
                  <td className="px-6 py-3.5 text-end">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                        agent.status === "ready"
                          ? "bg-emerald-100 text-emerald-900"
                          : agent.status === "connecting"
                            ? "bg-amber-100 text-amber-950"
                            : "bg-black/[0.05] text-muted-foreground",
                      )}
                    >
                      {getAgentStatusLabel(agent.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
