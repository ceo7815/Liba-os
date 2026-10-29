"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { ShemeshFilters } from "@/components/shemesh/filters";
import { useShemeshPulse } from "@/components/shemesh/pulse-context";
import { useShemeshFilter } from "@/components/shemesh/use-shemesh-view";
import { Panel, ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { formatShemeshCount, formatShemeshMoney } from "@/lib/shemesh/format";
import { sliceAds, type PulseChannel, type PulseRange } from "@/lib/shemesh/pulse";

const CHANNEL_LABEL: Record<PulseChannel, string> = {
  facebook: "פייסבוק",
  google: "גוגל",
};

export function ShemeshLeads() {
  const pulse = useShemeshPulse();
  const { filter } = useShemeshFilter();
  const channel: PulseRange["channel"] =
    filter.adPlatform === "facebook" || filter.adPlatform === "google" ? filter.adPlatform : "all";
  const ads = sliceAds(pulse, { from: filter.from, to: filter.to, channel });
  const facebook = ads.byChannel.find((row) => row.channel === "facebook");
  const google = ads.byChannel.find((row) => row.channel === "google");

  return (
    <ShemeshPage
      title="לידים"
      description="לידים שנרשמו בקמפיינים של שמש בגוגל ובפייסבוק. בלי פרטי לקוח."
      icon={Users}
      filters={<ShemeshFilters showPlatform />}
      stats={
        <>
          <Stat label="לידים" value={formatShemeshCount(ads.leads)} />
          <Stat label="פייסבוק" value={formatShemeshCount(facebook?.leads ?? 0)} />
          <Stat label="גוגל" value={formatShemeshCount(google?.leads ?? 0)} />
          <Stat label="עלות לליד" value={ads.cpl == null ? "—" : formatShemeshMoney(ads.cpl)} />
        </>
      }
    >
      <Panel
        title="לפי קמפיין"
        action={
          <Link href="/shemesh/marketing" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            לקמפיינים
          </Link>
        }
      >
        {ads.byCampaign.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">אין לידים בתקופה הזו.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-2 text-right font-medium">קמפיין</th>
                <th className="py-2 text-right font-medium">מקור</th>
                <th className="py-2 text-right font-medium">לידים</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">עלות לליד</th>
              </tr>
            </thead>
            <tbody>
              {ads.byCampaign.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="max-w-[16rem] truncate py-2.5 font-medium">{row.name}</td>
                  <td className="py-2.5 text-muted-foreground">{CHANNEL_LABEL[row.channel]}</td>
                  <td className="py-2.5 tabular-nums">{formatShemeshCount(row.leads)}</td>
                  <td className="hidden py-2.5 tabular-nums sm:table-cell">
                    {row.cpl == null ? "—" : formatShemeshMoney(row.cpl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </ShemeshPage>
  );
}
