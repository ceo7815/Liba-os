"use client";

import Link from "next/link";
import { ChevronLeft, Megaphone, UserRound, type LucideIcon } from "lucide-react";
import { ShemeshFilters } from "@/components/shemesh/filters";
import { useShemeshPulse } from "@/components/shemesh/pulse-context";
import { useShemeshFilter } from "@/components/shemesh/use-shemesh-view";
import { formatShemeshCount, formatShemeshDay, formatShemeshMoney } from "@/lib/shemesh/format";
import { readBoard, sliceAds, sliceMoney, type PulseChannel, type PulseRange } from "@/lib/shemesh/pulse";

const CHANNEL_LABEL: Record<PulseChannel, string> = {
  facebook: "פייסבוק",
  google: "גוגל",
};

export function ShemeshDashboard() {
  const pulse = useShemeshPulse();
  const { filter } = useShemeshFilter();
  const channel: PulseRange["channel"] =
    filter.adPlatform === "facebook" || filter.adPlatform === "google" ? filter.adPlatform : "all";
  const range: PulseRange = { from: filter.from, to: filter.to, channel };
  const ads = sliceAds(pulse, range);
  const money = sliceMoney(pulse, range);
  const board = readBoard(pulse, range, ads);
  const facebook = ads.byChannel.find((row) => row.channel === "facebook");
  const google = ads.byChannel.find((row) => row.channel === "google");
  const channels = [
    { channel: "facebook" as const, spend: facebook?.spend ?? 0, leads: facebook?.leads ?? 0, cpl: facebook?.cpl ?? null },
    { channel: "google" as const, spend: google?.spend ?? 0, leads: google?.leads ?? 0, cpl: google?.cpl ?? null },
  ].sort((a, b) => b.leads - a.leads || b.spend - a.spend);
  const leadingChannel = channels[0]?.leads || channels[0]?.spend ? channels[0] : null;
  const otherChannel = channels[1];
  const campaigns = [...ads.byCampaign].sort((a, b) => b.leads - a.leads || b.spend - a.spend).slice(0, 4);

  const leaders: {
    href: string;
    label: string;
    icon: LucideIcon;
    name: string;
    detail: string;
  }[] = [
    {
      href: "/shemesh/revenue",
      label: "עובד מוביל",
      icon: UserRound,
      name: board.leader?.name ?? "—",
      detail: board.leader
        ? `${formatShemeshCount(board.leader.count)} עסקאות · ${formatShemeshMoney(board.leader.sold)}`
        : "אין סגירות בתקופה",
    },
    {
      href: "/shemesh/marketing",
      label: "קמפיין מוביל",
      icon: Megaphone,
      name: board.campaign?.name ?? "—",
      detail: board.campaign
        ? `${formatShemeshCount(board.campaign.leads)} לידים בקמפיין אחד · ${CHANNEL_LABEL[board.campaign.channel]}`
        : "אין קמפיין בתקופה",
    },
    {
      href: "/shemesh/marketing",
      label: "ערוץ מוביל",
      icon: Megaphone,
      name: leadingChannel ? CHANNEL_LABEL[leadingChannel.channel] : "—",
      detail: leadingChannel
        ? `${formatShemeshCount(leadingChannel.leads)} לידים${otherChannel ? ` · ${CHANNEL_LABEL[otherChannel.channel]} ${formatShemeshCount(otherChannel.leads)}` : ""}`
        : "אין לידים בתקופה",
    },
    {
      href: "/shemesh/marketing",
      label: "עלות לליד",
      icon: Megaphone,
      name: ads.cpl != null ? formatShemeshMoney(ads.cpl) : "—",
      detail: ads.leads ? `${formatShemeshCount(ads.leads)} לידים · ${formatShemeshMoney(ads.spend)}` : "אין לידים בתקופה",
    },
  ];

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3 px-0.5">
        <div>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">לוח בקרה</h1>
          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
            {formatShemeshDay(filter.from)} עד {formatShemeshDay(filter.to)}
          </p>
        </div>
        <ShemeshFilters showPlatform />
      </header>

      <section className="relative overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
        <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
        <div className="grid grid-cols-2 gap-px bg-black/[0.06] lg:grid-cols-4">
          <HeroCell
            href="/shemesh/revenue"
            kicker="בתאריכים"
            label="מכרנו"
            value={formatShemeshMoney(board.sold)}
            hint={board.soldCount ? `${formatShemeshCount(board.soldCount)} עסקאות` : "אין עסקאות בתאריכים האלה"}
            tint
          />
          <HeroCell
            href="/shemesh/revenue"
            kicker="כל הקובץ"
            label="פתוח לגבייה"
            value={formatShemeshMoney(board.openBalance)}
            hint={board.openCount ? `${formatShemeshCount(board.openCount)} עסקאות שעדיין לא נגבו` : "אין יתרה פתוחה"}
          />
          <HeroCell
            href="/shemesh/marketing"
            kicker="בתאריכים"
            label="עלות קמפיינים"
            value={formatShemeshMoney(ads.spend)}
            hint={
              ads.byCampaign.length
                ? `${formatShemeshCount(ads.byCampaign.length)} קמפיינים${ads.cpl != null ? ` · ${formatShemeshMoney(ads.cpl)} לליד` : ""}`
                : "אין הוצאת פרסום"
            }
          />
          <HeroCell
            href="/shemesh/leads"
            kicker="בתאריכים"
            label="לידים"
            value={formatShemeshCount(ads.leads)}
            hint={ads.leads ? "נכנסו מהקמפיינים" : "אין לידים בתקופה"}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/[0.06] px-4 py-2 text-[11px] sm:px-5">
          <QuietLink href="/shemesh/revenue" label="נגבה" value={formatShemeshMoney(board.collectedInRange)} />
          <QuietLink href="/shemesh/expenses" label="תגמול עובדים" value={formatShemeshMoney(money.reward)} />
          <QuietLink
            href="/shemesh/revenue"
            label="נפרע · כל הקובץ"
            value={formatShemeshMoney(pulse.finance.settled)}
          />
        </div>
      </section>

      {campaigns.length > 0 ? (
        <section className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white sm:rounded-[var(--radius)]">
          <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] px-4 py-2 sm:px-5">
            <h2 className="text-sm font-semibold tracking-tight">קמפיינים בתקופה</h2>
            <Link href="/shemesh/marketing" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              לשיווק
              <ChevronLeft className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-px bg-black/[0.06] sm:grid-cols-4">
            {campaigns.map((row) => (
              <Link
                key={row.id}
                href="/shemesh/marketing"
                className="group bg-white px-4 py-3 text-start transition-colors hover:bg-highlight/10 sm:px-5"
              >
                <p className="truncate text-[11px] font-medium text-muted-foreground" title={row.name}>
                  {CHANNEL_LABEL[row.channel]}
                </p>
                <p className="mt-1 truncate text-base font-semibold tracking-tight" title={row.name}>
                  {row.name}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                  <span className="min-w-0 truncate">
                    {formatShemeshMoney(row.spend)} · {formatShemeshCount(row.leads)} לידים
                  </span>
                  <ChevronLeft className="size-3.5 shrink-0 opacity-40 transition-transform group-hover:-translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <h2 className="text-sm font-semibold tracking-tight">מובילים בתקופה</h2>
          <p className="text-[11px] text-muted-foreground">לחצו על קובייה לפירוט</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          {leaders.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="group relative min-w-0 overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white px-3 py-2.5 text-start transition-[background-color,border-color] hover:border-black/10 hover:bg-highlight/10 sm:rounded-[var(--radius)] sm:px-4 sm:py-3"
              >
                <span className="absolute inset-y-0 start-0 w-1 bg-highlight" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-highlight/35">
                      <Icon className="size-4" />
                    </span>
                    <p className="truncate text-[11px] font-medium text-muted-foreground">{item.label}</p>
                  </div>
                  <ChevronLeft className="size-3.5 shrink-0 text-black/30 transition-transform group-hover:-translate-x-0.5" />
                </div>
                <p className="mt-2 truncate text-base font-semibold tracking-tight">{item.name}</p>
                <p className="mt-1 truncate text-[11px] tabular-nums text-muted-foreground">{item.detail}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function HeroCell({
  href,
  kicker,
  label,
  value,
  hint,
  tint,
}: {
  href: string;
  kicker: string;
  label: string;
  value: string;
  hint: string;
  tint?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        tint
          ? "group bg-highlight/15 px-4 py-3 text-start transition-colors hover:bg-highlight/25 sm:px-5 sm:py-4"
          : "group bg-white px-4 py-3 text-start transition-colors hover:bg-highlight/10 sm:px-5 sm:py-4"
      }
    >
      <span className={tint ? "rounded-full bg-highlight px-2.5 py-0.5 text-[11px] font-semibold text-white" : "rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[11px] font-semibold"}>
        {kicker}
      </span>
      <p className="mt-2 text-[11px] font-medium tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold leading-none tracking-tight tabular-nums sm:text-4xl">{value}</p>
      <p className="mt-2 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <span className="min-w-0 truncate">{hint}</span>
        <ChevronLeft className="size-3.5 shrink-0 opacity-40 transition-transform group-hover:-translate-x-0.5" />
      </p>
    </Link>
  );
}

function QuietLink({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-highlight/10">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </Link>
  );
}
