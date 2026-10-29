import Link from "next/link";
import { Cable, ChevronLeft, FileSpreadsheet, ListChecks, Megaphone, Phone, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import type { ConnectedInterface } from "@/lib/interfaces/status";
import { cn } from "@/lib/utils";

const ICONS = {
  voicenter: Phone,
  "google-ads": Megaphone,
  facebook: Share2,
  "sales-excel": FileSpreadsheet,
  surense: ListChecks,
} as const;

export function InterfacesScreen({ items }: { items: ConnectedInterface[] }) {
  const connected = items.filter((item) => item.connected).length;

  return (
    <section className="w-full space-y-6" dir="rtl">
      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-xs font-medium text-muted-foreground">מערכת</p>
        <div className="mt-1 flex items-center gap-2.5">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
            <Cable className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">ממשקים מחוברים</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          כל מערכת חיצונית שמזינה את ליבה. ירוק אומר שהחיבור פעיל והנתונים נכנסים לכאן.
        </p>
        <p className="mt-4 text-sm font-medium text-emerald-800">
          {connected.toLocaleString("he-IL")} מחוברים
        </p>
      </div>

      {items
        .filter((item) => item.warning)
        .map((item) => (
          <div
            key={`${item.id}-warning`}
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            <p className="font-semibold">{item.warning}</p>
            {item.actionHref ? (
              <Button asChild size="sm" variant="outline">
                <a href={item.actionHref}>{item.actionLabel ?? "חיבור מחדש"}</a>
              </Button>
            ) : null}
          </div>
        ))}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = ICONS[item.id];
          const synced = formatLastUpdatedAt(item.syncedAt);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "group flex min-h-44 flex-col rounded-lg border bg-card p-5 shadow-[0_1px_0_rgba(17,17,17,0.03)] transition-colors",
                item.connected
                  ? "border-emerald-200/80 hover:border-emerald-300"
                  : "border-border hover:border-black/15",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-2xl",
                    item.connected ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                    item.connected ? "bg-emerald-50 text-emerald-800" : "bg-muted text-black/45",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      item.connected ? "bg-emerald-500" : "bg-black/25",
                    )}
                  />
                  {item.connected ? "מחובר" : "לא מחובר"}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight">{item.name}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                <p className="min-w-0 text-[12px] leading-relaxed text-muted-foreground">
                  {item.note ? <span className="block truncate">{item.note}</span> : null}
                  {synced ? <span className="block">{synced}</span> : null}
                </p>
                <ChevronLeft className="size-4 shrink-0 text-black/30 transition-transform group-hover:-translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
