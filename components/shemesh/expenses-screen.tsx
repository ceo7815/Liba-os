"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { ShemeshFilters } from "@/components/shemesh/filters";
import { useShemeshPulse } from "@/components/shemesh/pulse-context";
import { useShemeshFilter } from "@/components/shemesh/use-shemesh-view";
import { Panel, ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { formatShemeshMoney } from "@/lib/shemesh/format";
import { sliceMoney } from "@/lib/shemesh/pulse";

export function ShemeshExpenses() {
  const pulse = useShemeshPulse();
  const { filter } = useShemeshFilter();
  const money = sliceMoney(pulse, { from: filter.from, to: filter.to, channel: "all" });

  return (
    <ShemeshPage
      title="הוצאות"
      description="משכורות וריווחית עדיין לא מחוברים. מהקובץ יש רק תגמול שנרשם על חשבוניות."
      icon={Receipt}
      filters={<ShemeshFilters />}
      stats={
        <>
          <Stat label="תגמול בחשבוניות" value={formatShemeshMoney(money.reward)} hint="כפי שנרשם בדוח" />
          <Stat label="משכורות" value="לא מחובר" />
          <Stat label="ריווחית" value="לא מחובר" />
        </>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="מה יש בקובץ">
          <p className="py-2 text-sm leading-relaxed text-muted-foreground">
            עמודת תגמול העובד בגיליון החשבוניות. זה לא משכורת ולא הוצאת משרד.
          </p>
          <Link href="/shemesh/revenue" className="text-sm font-medium underline-offset-4 hover:underline">
            לחשבוניות
          </Link>
        </Panel>
        <Panel title="מה שעדיין חסר">
          <ul className="space-y-2 py-2 text-sm text-muted-foreground">
            <li>משכורות העובדים, אחרי שיהיה מקור שכר.</li>
            <li>חשבוניות ספק מריווחית.</li>
          </ul>
        </Panel>
      </div>
    </ShemeshPage>
  );
}
