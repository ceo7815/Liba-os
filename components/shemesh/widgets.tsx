import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = ["sun", "green", "violet", "teal", "coral"] as const;

type StatPaint = { hero?: boolean; tone?: (typeof TONES)[number] };

function flattenStats(node: ReactNode): ReactNode[] {
  const items: ReactNode[] = [];
  Children.forEach(node, (child) => {
    if (isValidElement(child) && child.type === Fragment) {
      items.push(...flattenStats((child.props as { children?: ReactNode }).children));
      return;
    }
    items.push(child);
  });
  return items;
}

function paintStats(stats: ReactNode) {
  return flattenStats(stats).map((child, index) => {
    if (!isValidElement(child)) return child;
    const tone = TONES[index % TONES.length];
    return cloneElement(child as ReactElement<StatPaint>, {
      hero: index === 0,
      tone,
    });
  });
}

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
  stats?: ReactNode;
  filters?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto min-w-0 max-w-[72rem] space-y-6">
      <div className="glass glass-noise px-3 py-4 sm:px-7 sm:py-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">שמש</p>
            <div className="mt-1 flex min-w-0 items-center gap-2.5">
              <span className="kpi-badge shrink-0" data-tone="sun" aria-hidden>
                <Icon className="size-4" />
              </span>
              <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            </div>
            <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        {filters ? <div className="mt-5 min-w-0 border-t border-white/70 pt-4">{filters}</div> : null}
        {stats ? <div className="kpi-band mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">{paintStats(stats)}</div> : null}
      </div>
      <div className="min-w-0 space-y-6">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  hero,
  tone = "teal",
}: {
  label: string;
  value: string;
  hint?: string;
  hero?: boolean;
  tone?: (typeof TONES)[number];
}) {
  return (
    <div className={cn("kpi-cube min-w-0 px-4 py-3.5 sm:px-5 sm:py-4", hero && "kpi-hero")} data-accent={hero ? undefined : tone}>
      <span className="kpi-badge" data-tone={tone} aria-hidden />
      <p className="mt-2 text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-2xl font-semibold leading-none tracking-tight sm:text-3xl">{value}</p>
      {hint ? <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ShemeshSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="skeleton h-8 w-40 rounded-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="skeleton h-28 rounded-[20px]" />
        <div className="skeleton h-28 rounded-[20px]" />
        <div className="skeleton h-28 rounded-[20px]" />
        <div className="skeleton h-28 rounded-[20px]" />
      </div>
      <div className="skeleton h-64 rounded-[20px]" />
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/70 px-3 py-3 sm:px-5">
        <h2 className="min-w-0 break-words text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="min-w-0 px-3 py-3 sm:px-5">{children}</div>
    </section>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
