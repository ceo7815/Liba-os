import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { ShemeshEmpty } from "@/components/shemesh/empty-state";
import { ShemeshPage } from "@/components/shemesh/widgets";
import { loadShemeshAlerts } from "@/lib/shemesh/alerts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "התראות · שמש" };

export default async function ShemeshAlertsPage() {
  const view = await loadShemeshAlerts();
  return (
    <ShemeshPage
      title="מרכז התראות"
      description="חריגות SLA, מסמכים חסרים, יעדים קרובים, Sheet-6 בלי תיק, וכשל סנכרון. אין כאן שורה שהומצאה."
      icon={Bell}
    >
      {view.missing ? (
        <ShemeshEmpty icon={Bell} title="התיקים עדיין לא נקראו" body="אחרי שהמיגרציה רצה, ההתראות נבנות מהתיקים ומהחיבורים השמורים." />
      ) : view.alerts.length === 0 ? (
        <ShemeshEmpty icon={Bell} title="אין התראות פתוחות" body="אין חריגת SLA, מסמך חסר, או כשל סנכרון שמור." />
      ) : (
        <ul className="space-y-2">
          {view.alerts.map((alert) => (
            <li key={alert.id}>
              <Link href={alert.href} className="glass flex items-start gap-3 px-4 py-3 hover:bg-white/80">
                <span className="kpi-badge mt-0.5 !size-8" data-tone={alert.tone} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{alert.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{alert.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ShemeshPage>
  );
}
