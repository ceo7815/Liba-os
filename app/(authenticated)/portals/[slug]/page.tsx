import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpLeft, Database, Layers3 } from "lucide-react";
import {
  getPortalBySlug,
  getPortalStatusLabel,
  portals,
} from "@/lib/portals.config";

type PageProps = {
  params: { slug: string };
};

export function generateStaticParams() {
  return portals.map((portal) => ({ slug: portal.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const portal = getPortalBySlug(params.slug);
  return {
    title: portal ? `פורטל ${portal.name}` : "פורטל",
  };
}

export default function PortalPage({ params }: PageProps) {
  const portal = getPortalBySlug(params.slug);
  if (!portal) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-[72rem] space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link href="/portals" className="font-medium hover:text-foreground">
          איחוד פורטלים
        </Link>
        <span>/</span>
        <span className="text-foreground">{portal.name}</span>
      </div>

      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background">
              <Layers3 className="h-5 w-5 text-black/60" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                פורטל {portal.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {portal.description}
              </p>
            </div>
          </div>
          <span className="inline-flex rounded-md bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {getPortalStatusLabel(portal.status)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="app-surface p-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-black/45" />
            <h2 className="text-base font-semibold">מרחב נתונים</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            כאן יתנקזו הנתונים מפורטל {portal.name} — פוליסות, לקוחות, סטטוסים
            ועדכונים. החיבור לפורטל יופעל בשלב הבא.
          </p>
          <div className="mt-6 rounded-xl border border-black/[0.06] bg-background px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">אין נתונים עדיין</p>
            <p className="mt-1 text-xs text-muted-foreground">
              המסך מוכן. מחכים לחיבור מקור הנתונים.
            </p>
          </div>
        </div>

        <div className="app-surface p-5">
          <h2 className="text-base font-semibold">פורטלים נוספים</h2>
          <ul className="mt-3 space-y-1">
            {portals
              .filter((p) => p.slug !== portal.slug)
              .map((p) => (
                <li key={p.slug}>
                  <Link
                    href={p.href}
                    className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-black/60 transition-colors hover:bg-background hover:text-foreground"
                  >
                    <span>{p.name}</span>
                    <ArrowUpLeft className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
          </ul>
          <Link
            href="/portals"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            חזרה לסקירה
            <ArrowUpLeft className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
