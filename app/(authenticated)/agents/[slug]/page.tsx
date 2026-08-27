import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Link2 } from "lucide-react";
import {
  agents,
  getAgentBySlug,
  getAgentStatusLabel,
} from "@/lib/agents.config";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  AgentDashboard,
  type AgentDashboardData,
} from "@/components/agents/agent-dashboard";
import { AgentInDevelopmentDialog } from "@/components/agents/agent-in-development-dialog";
import { RequestAnalysisButton } from "@/components/agents/request-analysis-button";
import { listAgentApiKeys } from "@/app/actions/agents";
import { SocialMediaDashboard } from "@/components/social-media/social-media-dashboard";
import { loadSocialDashboard } from "@/app/actions/social-media";
import { todayJerusalemDateKey } from "@/lib/social-media/calendar-ui";
import { getHolidaysForMonth } from "@/lib/social-media/holidays";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { slug: string };
  searchParams?: { year?: string; month?: string };
};

export function generateStaticParams() {
  return agents.map((agent) => ({ slug: agent.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const agent = getAgentBySlug(params.slug);
  return {
    title: agent ? agent.name : "סוכן AI",
  };
}

function parseMonthYear(searchParams?: PageProps["searchParams"]) {
  const today = todayJerusalemDateKey();
  const [ty, tm] = today.split("-").map(Number);
  const year = Number(searchParams?.year) || ty;
  const month = Number(searchParams?.month) || tm;
  if (month < 1 || month > 12) return { year: ty, month: tm };
  return { year, month };
}

export default async function AgentPage({ params, searchParams }: PageProps) {
  const agent = getAgentBySlug(params.slug);
  if (!agent) {
    notFound();
  }

  if (agent.status !== "ready") {
    return (
      <section className="mx-auto max-w-[72rem] space-y-6">
        <AgentInDevelopmentDialog agentName={agent.name} />

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href="/agents" className="font-medium hover:text-foreground">
            סוכני AI
          </Link>
          <span>/</span>
          <span className="text-foreground">{agent.name}</span>
        </div>

        <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background">
                <Bot className="h-5 w-5 text-black/60" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {agent.name}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {agent.description}
                </p>
              </div>
            </div>
            <span className="inline-flex rounded-md bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {getAgentStatusLabel(agent.status)}
            </span>
          </div>
        </div>

        <div className="app-surface px-5 py-12 text-center sm:px-7">
          <p className="text-sm font-semibold">הסוכן בפיתוח</p>
        </div>
      </section>
    );
  }

  if (agent.slug === "social-media") {
    const { year, month } = parseMonthYear(searchParams);
    const socialData = await loadSocialDashboard(year, month);
    const holidays = await getHolidaysForMonth(year, month);
    const profile = await getCurrentProfile();
    const isAdmin = profile?.role === "admin";
    const keys = isAdmin
      ? (await listAgentApiKeys("social-media")).keys
      : [];
    const supabase = createClient();
    const { data: dbAgent } = await supabase
      .from("agents")
      .select("hermes_status, hermes_last_seen_at")
      .eq("slug", "social-media")
      .maybeSingle();

    return (
      <section className="mx-auto max-w-[72rem] space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href="/agents" className="font-medium hover:text-foreground">
            סוכני AI
          </Link>
          <span>/</span>
          <span className="text-foreground">{agent.name}</span>
        </div>

        <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background">
                <Bot className="h-5 w-5 text-black/60" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {agent.name}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {agent.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 className="h-3 w-3" />
                    Liba OS · תור פרסום דרך ראנר חיצוני
                  </span>
                  <span>
                    ראנר:{" "}
                    {dbAgent?.hermes_status === "online"
                      ? "מחובר"
                      : dbAgent?.hermes_status === "offline"
                        ? "לא מחובר"
                        : "ממתין ל-heartbeat"}
                  </span>
                </div>
              </div>
            </div>
            <span className="inline-flex rounded-md bg-highlight/40 px-2.5 py-1 text-[11px] font-medium text-foreground">
              {getAgentStatusLabel(agent.status)}
            </span>
          </div>
        </div>

        <SocialMediaDashboard
          agentName={agent.name}
          initialYear={year}
          initialMonth={month}
          data={socialData}
          holidays={holidays}
          isAdmin={Boolean(isAdmin)}
          keys={keys}
          hermesStatus={dbAgent?.hermes_status ?? null}
          hermesLastSeenAt={dbAgent?.hermes_last_seen_at ?? null}
        />
      </section>
    );
  }

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const supabase = createClient();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: dbAgent } = await supabase
    .from("agents")
    .select(
      "id, slug, name, status, hermes_profile, model, schedule_cron, last_run_at, last_run_status, hermes_status, hermes_last_seen_at",
    )
    .eq("slug", agent.slug)
    .maybeSingle();

  const agentId = dbAgent?.id ?? null;

  const [toolsRes, runsRes, costsRes, callsRes, activeQueueRes] =
    await Promise.all([
      agentId
        ? supabase
            .from("agent_tools")
            .select("id, tool_name, tool_type, status, last_checked_at")
            .eq("agent_id", agentId)
            .order("tool_name")
        : Promise.resolve({ data: [] as AgentDashboardData["tools"] }),
      agentId
        ? supabase
            .from("agent_runs")
            .select(
              "id, trigger, started_at, finished_at, status, items_processed, items_failed, cost_usd, input_tokens, output_tokens",
            )
            .eq("agent_id", agentId)
            .order("started_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] as AgentDashboardData["runs"] }),
      agentId
        ? supabase
            .from("agent_costs")
            .select("id, service, units, unit_type, cost_usd, occurred_at")
            .eq("agent_id", agentId)
            .gte("occurred_at", monthStart.toISOString())
            .order("occurred_at", { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [] as AgentDashboardData["costs"] }),
      supabase
        .from("calls")
        .select(
          "id, external_id, source, status, call_date, duration_sec, audio_path, metadata, call_analyses(overall_score, created_at)",
        )
        .order("created_at", { ascending: false })
        .limit(20),
      agentId
        ? supabase
            .from("agent_runs")
            .select("id, status")
            .eq("agent_id", agentId)
            .in("status", ["queued", "claimed", "running"])
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({
            data: null as { id: string; status: string } | null,
          }),
    ]);

  const monthlyCostUsd = (costsRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.cost_usd ?? 0),
    0,
  );

  const calls: AgentDashboardData["calls"] = (callsRes.data ?? []).map((row) => {
    const analysesRaw = Array.isArray(row.call_analyses)
      ? row.call_analyses
      : row.call_analyses
        ? [row.call_analyses]
        : [];
    const analysesSorted = [...analysesRaw].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
    const latest = analysesSorted[0] ?? null;

    const metadata =
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null;

    return {
      id: row.id,
      external_id: row.external_id,
      source: row.source,
      status: row.status,
      call_date: row.call_date,
      duration_sec: row.duration_sec,
      audio_path: row.audio_path ?? null,
      metadata,
      transcript: null,
      analysis: latest
        ? {
            overall_score: latest.overall_score,
            summary: null,
            recommendations: null,
            rubric_scores: null,
            findings: null,
            model: null,
          }
        : null,
    };
  });

  const activeQueueStatus = activeQueueRes.data?.status ?? null;

  const dashboardData: AgentDashboardData = {
    dbAgent: dbAgent ?? null,
    tools: toolsRes.data ?? [],
    runs: runsRes.data ?? [],
    costs: costsRes.data ?? [],
    calls,
    monthlyCostUsd,
    keys: [],
    isAdmin: Boolean(isAdmin),
    activeQueueStatus,
    agentSlug: agent.slug,
  };

  return (
    <section className="mx-auto max-w-[72rem] space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link href="/agents" className="font-medium hover:text-foreground">
          סוכני AI
        </Link>
        <span>/</span>
        <span className="text-foreground">{agent.name}</span>
      </div>

      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background">
              <Bot className="h-5 w-5 text-black/60" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {agent.name}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {agent.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Link2 className="h-3 w-3" />
                  {agent.externalBaseUrl ? (
                    <span dir="ltr" className="font-medium text-foreground">
                      {agent.externalBaseUrl}
                    </span>
                  ) : (
                    `${agent.name} · דיווח דרך /api/mcp`
                  )}
                </span>
              </div>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex rounded-md px-2.5 py-1 text-[11px] font-medium",
              agent.status === "ready"
                ? "bg-highlight/40 text-foreground"
                : "bg-background text-muted-foreground",
            )}
          >
            {getAgentStatusLabel(agent.status)}
          </span>
        </div>
      </div>

      {isAdmin && agent.slug === "call-control" && (
        <div className="app-surface border border-highlight/50 bg-highlight/10 p-5">
          <RequestAnalysisButton
            slug={agent.slug}
            activeStatus={activeQueueStatus ?? dbAgent?.last_run_status ?? null}
          />
        </div>
      )}

      <AgentDashboard agentName={agent.name} data={dashboardData} />
    </section>
  );
}
