import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Construction, Link2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

type PageProps = {
  params: { slug: string };
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

export default async function AgentPage({ params }: PageProps) {
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
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-highlight/30">
            <Construction className="size-5" />
          </span>
          <p className="mt-4 text-sm font-semibold">הסוכן בפיתוח</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
            המסך מוכן. כשהסוכן יחובר למערכת — יופיעו כאן פעילות, עלויות ותוצרים.
          </p>
        </div>
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

  // Slim payload: no transcripts / full findings on first paint (loaded on call select).
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
