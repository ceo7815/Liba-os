import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpLeft, Bot, Link2 } from "lucide-react";
import {
  agents,
  getAgentStatusLabel,
} from "@/lib/agents.config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "סוכני AI",
};

export default function AgentsPage() {
  const ready = agents.filter((a) => a.status === "ready").length;
  const connecting = agents.filter((a) => a.status === "connecting").length;
  const planned = agents.filter((a) => a.status === "planned").length;

  return (
    <section className="mx-auto max-w-[72rem] space-y-6">
      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">עבודה</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">סוכני AI</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              מערך הסוכנים רץ במערכת נפרדת. ליבה OS מציגה כאן את כל הנתונים:
              פעילות, עלויות, היסטוריה, סיכומים והמלצות.
            </p>
          </div>
          <div className="flex flex-wrap gap-6">
            <Stat label="סוכנים" value={agents.length} />
            <Stat label="מחוברים" value={ready} accent={ready > 0} />
            <Stat label="בחיבור" value={connecting} accent={ready === 0 && connecting > 0} />
            <Stat label="מתוכננים" value={planned} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <Link
            key={agent.slug}
            href={agent.href}
            className="agent-tool-cube group app-surface block p-5 transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-background/50 hover:shadow-[0_10px_24px_rgba(17,17,17,0.08)]"
            style={{ opacity: 1, animation: "none" }}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                <Bot className="h-4 w-4 text-black/60" />
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium",
                  agent.status === "ready"
                    ? "bg-highlight/40 text-foreground"
                    : "bg-background text-muted-foreground",
                )}
              >
                {agent.status === "ready" ? (
                  <span className="status-live-dot" aria-hidden />
                ) : null}
                {getAgentStatusLabel(agent.status)}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">{agent.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {agent.description}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Link2 className="h-3 w-3" />
              {agent.status === "ready"
                ? "מחובר למערכת הסוכנים · דיווח פעיל"
                : agent.externalBaseUrl
                  ? "מקושר לזמן־ריצה חיצוני"
                  : "ממתין לחיבור מערכת הסוכנים"}
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              פתיחת לוח הסוכן
              <ArrowUpLeft className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {accent && <span className="mt-2 block h-[3px] w-8 rounded-full bg-highlight" />}
    </div>
  );
}
