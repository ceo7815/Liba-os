import type { LucideIcon } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";

export function ShemeshPage({
  title,
  description,
  icon: Icon,
  stats,
  filters,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  stats?: React.ReactNode;
  filters?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[72rem] space-y-6">
      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">שמש</p>
            <div className="mt-1 flex items-center gap-2.5">
              <IconBadge tone="shemesh">
                <Icon className="size-5" />
              </IconBadge>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {filters ? <div className="mt-5 border-t border-black/[0.06] pt-4">{filters}</div> : null}
        {stats ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi-cube rounded-2xl px-4 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="app-surface">
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="px-5 py-3">{children}</div>
    </section>
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="size-2 rounded-full bg-highlight" aria-hidden />
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
