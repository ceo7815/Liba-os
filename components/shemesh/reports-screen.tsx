"use client";

import Link from "next/link";
import { LineChart } from "lucide-react";
import { ShemeshFilters } from "@/components/shemesh/filters";
import { useShemeshPulse } from "@/components/shemesh/pulse-context";
import { useShemeshFilter } from "@/components/shemesh/use-shemesh-view";
import { Panel, ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { formatShemeshMoney, formatShemeshMonth } from "@/lib/shemesh/format";
import { SHEMESH_SALES_SOURCE_LABEL } from "@/lib/shemesh/sales-source";
import { sliceAds, sliceMoney, type PulseChannel, type PulseRange } from "@/lib/shemesh/pulse";
import type { ShemeshBooks } from "@/lib/shemesh/story";

const CHANNEL_LABEL: Record<PulseChannel, string> = {
  facebook: "פייסבוק",
  google: "גוגל",
};

export function ShemeshReports({ books = null }: { books?: ShemeshBooks | null }) {
  const pulse = useShemeshPulse();
  const { filter } = useShemeshFilter();
  const channel: PulseRange["channel"] =
    filter.adPlatform === "facebook" || filter.adPlatform === "google" ? filter.adPlatform : "all";
  const range: PulseRange = { from: filter.from, to: filter.to, channel };
  const ads = sliceAds(pulse, range);
  const money = sliceMoney(pulse, range);
  const live = books && !books.missing ? books : null;
  const collected = money.collected;
  const afterAds = collected - ads.spend;

  return (
    <ShemeshPage
      title="רווח והפסד"
      description={`הנגבה נקרא רק מ־${SHEMESH_SALES_SOURCE_LABEL}. הוצאות קבועות ושכר הם ספר תפעול, לא דוח ליבה.`}
      icon={LineChart}
      filters={
        <div className="flex flex-wrap items-center gap-3">
          <ShemeshFilters showPlatform />
          <a className="text-sm font-medium text-[#2f86ea]" href="/api/shemesh/export?kind=pack">חבילת דוחות לאקסל</a>
        </div>
      }
      stats={
        <>
          <Stat label="נגבה" value={formatShemeshMoney(collected)} hint="גיליון הגבייה בדוח שמש" />
          <Stat label="פרסום" value={formatShemeshMoney(ads.spend)} />
          <Stat label="אחרי פרסום" value={formatShemeshMoney(afterAds)} />
          <Stat label="הוצאות קבועות" value={live ? formatShemeshMoney(live.monthCost) : "—"} hint="ספר, לא מכירות" />
        </>
      }
    >
      {live ? (
        <Panel title={`ספר תפעול ${formatShemeshMonth(live.month)}`}>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-3"><span>שכר טרחה בספר, לא בדוח</span><span className="tabular-nums">{formatShemeshMoney(live.collectedNet)}</span></li>
            <li className="flex justify-between gap-3"><span>הוצאות קבועות</span><span className="tabular-nums">{formatShemeshMoney(live.monthCost)}</span></li>
            <li className="flex justify-between gap-3"><span>שכר</span><span className="tabular-nums">{formatShemeshMoney(live.monthPayroll)}</span></li>
            <li className="flex justify-between gap-3"><span>עמלת מטפל</span><span className="tabular-nums">{formatShemeshMoney(live.monthCommission)}</span></li>
            <li className="flex justify-between gap-3"><span>החזר חוב</span><span className="tabular-nums">{formatShemeshMoney(live.monthDebt)}</span></li>
            <li className="flex justify-between gap-3"><span>עמלת רישיון של ליבה</span><span className="tabular-nums">{formatShemeshMoney(live.licenseCommission)}</span></li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">פרסום החשבונות מוצג בנפרד למטה ואינו משנה את הנגבה. עמלת הרישיון שייכת לליבה.</p>
        </Panel>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="לפי חודש">
          {money.byMonth.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">אין גבייה או פרסום בתקופה. הגבייה מגיעה רק אחרי ייבוא דוח שמש.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-2 text-right font-medium">חודש</th>
                  <th className="py-2 text-right font-medium">נגבה</th>
                  <th className="py-2 text-right font-medium">פרסום</th>
                  <th className="py-2 text-right font-medium">אחרי פרסום</th>
                </tr>
              </thead>
              <tbody>
                {money.byMonth.map((row) => (
                  <tr key={row.month} className="border-t border-border">
                    <td className="py-2.5 tabular-nums" dir="ltr">
                      {formatShemeshMonth(row.month)}
                    </td>
                    <td className="py-2.5 tabular-nums">{formatShemeshMoney(row.collected)}</td>
                    <td className="py-2.5 tabular-nums">{formatShemeshMoney(row.spend)}</td>
                    <td className="py-2.5 tabular-nums">{formatShemeshMoney(row.result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="פרסום לפי מקור">
          {ads.byChannel.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">אין פרסום בתקופה הזו.</p>
          ) : (
            <ul className="divide-y divide-border">
              {ads.byChannel.map((row) => (
                <li key={row.channel} className="flex items-center justify-between py-3 text-sm">
                  <span>{CHANNEL_LABEL[row.channel]}</span>
                  <span className="font-medium tabular-nums">{formatShemeshMoney(row.spend)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            נוסחאות העמלה נשארות כבויות עד אישור.{" "}
            <Link href="/shemesh/formulas" className="text-foreground underline-offset-4 hover:underline">
              לנוסחאות
            </Link>
          </p>
        </Panel>
      </div>
    </ShemeshPage>
  );
}
