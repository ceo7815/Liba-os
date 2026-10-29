import type { LucideIcon } from "lucide-react";

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
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/35">
                <Icon className="size-5" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {filters ? <div className="mt-5 border-t border-border pt-4">{filters}</div> : null}
        {stats ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-muted px-4 py-3">
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
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="px-5 py-3">{children}</div>
    </section>
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
