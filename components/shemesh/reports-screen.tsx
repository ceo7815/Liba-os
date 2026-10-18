"use client";

import Link from "next/link";
import { LineChart } from "lucide-react";
import { ShemeshFilters } from "@/components/shemesh/filters";
import { useShemeshPulse } from "@/components/shemesh/pulse-context";
import { useShemeshFilter } from "@/components/shemesh/use-shemesh-view";
import { Panel, ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { formatShemeshMoney, formatShemeshMonth } from "@/lib/shemesh/format";
import { sliceAds, sliceMoney, type PulseChannel, type PulseRange } from "@/lib/shemesh/pulse";

const CHANNEL_LABEL: Record<PulseChannel, string> = {
  facebook: "פייסבוק",
  google: "גוגל",
};

export function ShemeshReports() {
  const pulse = useShemeshPulse();
  const { filter } = useShemeshFilter();
  const channel: PulseRange["channel"] =
    filter.adPlatform === "facebook" || filter.adPlatform === "google" ? filter.adPlatform : "all";
  const range: PulseRange = { from: filter.from, to: filter.to, channel };
  const ads = sliceAds(pulse, range);
  const money = sliceMoney(pulse, range);
  const afterAds = money.collected - ads.spend;

  return (
    <ShemeshPage
      title="רווח והפסד"
      description="נגבה מתוך הגבייה, פחות פרסום. משכורות ונוסחאות עמלה לא נכנסות לחישוב."
      icon={LineChart}
      filters={<ShemeshFilters showPlatform />}
      stats={
        <>
          <Stat label="נגבה" value={formatShemeshMoney(money.collected)} />
          <Stat label="פרסום" value={formatShemeshMoney(ads.spend)} />
          <Stat label="אחרי פרסום" value={formatShemeshMoney(afterAds)} />
          <Stat label="הוצאות משרד" value="לא מחובר" hint="ריווחית ומשכורות" />
        </>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="לפי חודש">
          {money.byMonth.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">אין גבייה או פרסום בתקופה הזו.</p>
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
                  <tr key={row.month} className="border-t border-black/[0.06]">
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
            <ul className="divide-y divide-black/[0.06]">
              {ads.byChannel.map((row) => (
                <li key={row.channel} className="flex items-center justify-between py-3 text-sm">
                  <span>{CHANNEL_LABEL[row.channel]}</span>
                  <span className="font-medium tabular-nums">{formatShemeshMoney(row.spend)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-black/[0.06] pt-3 text-sm text-muted-foreground">
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
