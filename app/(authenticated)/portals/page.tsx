import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpLeft, Layers3 } from "lucide-react";
import {
  getPortalStatusLabel,
  portals,
} from "@/lib/portals.config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "איחוד פורטלים",
};

export default function PortalsOverviewPage() {
  const planned = portals.filter((p) => p.status === "planned").length;
  const ready = portals.filter((p) => p.status === "ready").length;
  const connecting = portals.filter((p) => p.status === "connecting").length;

  return (
    <section className="mx-auto max-w-[72rem] space-y-6">
      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">עבודה</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              איחוד פורטלים
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              אזור מרכזי לריכוז מידע מחברות הביטוח והפורטלים — במקום אחד.
              כל פורטל יחובר בהמשך למשיכת נתונים אוטומטית.
            </p>
          </div>
          <div className="flex flex-wrap gap-6">
            <Stat label="פורטלים" value={portals.length} />
            <Stat label="מחוברים" value={ready} />
            <Stat label="בחיבור" value={connecting} />
            <Stat label="בהכנה" value={planned} accent />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {portals.map((portal) => (
          <Link
            key={portal.slug}
            href={portal.href}
            className="app-surface group block p-4 transition-colors hover:bg-background/50"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                <Layers3 className="h-4 w-4 text-black/60" />
              </span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-medium",
                  portal.status === "ready"
                    ? "bg-highlight/40 text-foreground"
                    : "bg-background text-muted-foreground",
                )}
              >
                {getPortalStatusLabel(portal.status)}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">
              {portal.name}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {portal.description}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              כניסה לפורטל
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
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {accent && <span className="mt-2 block h-[3px] w-8 rounded-full bg-highlight" />}
    </div>
  );
}
