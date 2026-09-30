"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { loadDashboardCampaignPulse, type DashboardCampaignPulse } from "@/app/actions/dashboard-pulse";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CAMPAIGNS_PATH } from "@/lib/sales-dashboard/access";
import { formatIls } from "@/lib/sales-dashboard/campaign-math";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";

function dayLabel(iso: string): string {
  const [year, month, date] = iso.split("-");
  if (!year || !month || !date) return iso;
  return `${Number(date)}.${Number(month)}.${year.slice(2)}`;
}

function money(value: number): string {
  return formatIls(Math.round(value));
}

export function DashboardCampaignStrip() {
  const [pulse, setPulse] = useState<DashboardCampaignPulse | null | undefined>(undefined);
  const [open, setOpen] = useState<"spend" | "calls" | "forms" | "today" | null>(null);

  useEffect(() => {
    let alive = true;
    void loadDashboardCampaignPulse()
      .then((next) => {
        if (alive) setPulse(next);
      })
      .catch(() => {
        if (alive) setPulse(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (pulse === undefined) {
    return <div className="h-24 animate-pulse rounded-[1.25rem] border border-black/[0.06] bg-white" />;
  }
  if (!pulse) return null;

  const synced = formatLastUpdatedAt(pulse.googleSyncedAt || pulse.facebookSyncedAt);
  const callPrice = pulse.googleCalls > 0 ? pulse.googleSpend / pulse.googleCalls : null;
  const formPrice = pulse.facebookForms > 0 ? pulse.facebookSpend / pulse.facebookForms : null;

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white sm:rounded-[var(--radius)]">
      <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] px-4 py-2 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">קמפיינים החודש</h2>
          <p className="text-[11px] text-muted-foreground">
            {dayLabel(pulse.from)} עד {dayLabel(pulse.to)}
            {synced ? ` · עודכן ${synced}` : ""}
          </p>
        </div>
        <Link href={CAMPAIGNS_PATH} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          מרכז הקמפיינים
          <ArrowUpLeft className="size-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-px bg-black/[0.06] sm:grid-cols-4">
        <PulseCell label="הוצאה" value={money(pulse.spend)} hint="גוגל ופייסבוק" onClick={() => setOpen("spend")} />
        <PulseCell label="שיחות גוגל" value={pulse.googleCalls.toLocaleString("he-IL")} hint={callPrice == null ? "אין שיחות" : `${money(callPrice)} לשיחה`} onClick={() => setOpen("calls")} />
        <PulseCell label="טפסי פייסבוק" value={pulse.facebookForms.toLocaleString("he-IL")} hint={formPrice == null ? "אין טפסים" : `${money(formPrice)} לטופס`} onClick={() => setOpen("forms")} />
        <PulseCell
          label="היום"
          value={money(pulse.todaySpend)}
          hint={`${pulse.todayGoogleCalls.toLocaleString("he-IL")} שיחות · ${pulse.todayFacebookForms.toLocaleString("he-IL")} טפסים`}
          onClick={() => setOpen("today")}
        />
      </div>
      <Dialog open={open != null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-w-md">
          <CampaignExplain id={open} pulse={pulse} />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PulseCell({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="bg-white px-4 py-2.5 text-start hover:bg-[#fffcf0]">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>
    </button>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 border-t border-black/[0.06] py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function CampaignExplain({
  id,
  pulse,
}: {
  id: "spend" | "calls" | "forms" | "today" | null;
  pulse: DashboardCampaignPulse;
}) {
  if (!id) return null;
  const title = id === "spend" ? "הוצאה" : id === "calls" ? "שיחות גוגל" : id === "forms" ? "טפסי פייסבוק" : "היום";
  const note =
    id === "calls"
      ? "כמה שיחות גוגל ספרה על המודעות בימים האלה. זו ספירת הקמפיין, לא רשימת השעה והמשך."
      : id === "forms"
        ? "כמה טפסים פייסבוק ספרה. טופס אחד נספר פעם אחת."
        : id === "today"
          ? "רק היום, מאותם נתונים שמורים."
          : "סכום מה ששולם בגוגל ובפייסבוק מתחילת החודש עד היום.";
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{note}</DialogDescription>
      </DialogHeader>
      {id === "spend" ? (
        <div>
          <Line label="גוגל" value={money(pulse.googleSpend)} />
          <Line label="פייסבוק" value={money(pulse.facebookSpend)} />
          <Line label="ביחד" value={money(pulse.spend)} />
        </div>
      ) : null}
      {id === "calls" ? (
        <div>
          <Line label="שיחות" value={pulse.googleCalls.toLocaleString("he-IL")} />
          <Line label="הוצאת גוגל" value={money(pulse.googleSpend)} />
          <Line label="מחיר לשיחה" value={pulse.googleCalls > 0 ? `${money(pulse.googleSpend)} ÷ ${pulse.googleCalls.toLocaleString("he-IL")}` : "—"} />
        </div>
      ) : null}
      {id === "forms" ? (
        <div>
          <Line label="טפסים" value={pulse.facebookForms.toLocaleString("he-IL")} />
          <Line label="הוצאת פייסבוק" value={money(pulse.facebookSpend)} />
          <Line label="מחיר לטופס" value={pulse.facebookForms > 0 ? `${money(pulse.facebookSpend)} ÷ ${pulse.facebookForms.toLocaleString("he-IL")}` : "—"} />
        </div>
      ) : null}
      {id === "today" ? (
        <div>
          <Line label="הוצאה" value={money(pulse.todaySpend)} />
          <Line label="שיחות גוגל" value={pulse.todayGoogleCalls.toLocaleString("he-IL")} />
          <Line label="טפסי פייסבוק" value={pulse.todayFacebookForms.toLocaleString("he-IL")} />
        </div>
      ) : null}
    </>
  );
}
