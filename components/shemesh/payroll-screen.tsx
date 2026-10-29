"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Panel } from "@/components/shemesh/widgets";
import { field, ModulePage } from "@/components/shemesh/module-shell";
import { formatShemeshMoney } from "@/lib/shemesh/format";
import { collectionBonus, hourlyGross, type BonusBand } from "@/lib/shemesh/calculators";

export function PayrollScreen() {
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [collected, setCollected] = useState("");
  const [bands, setBands] = useState<BonusBand[]>([]);
  const [ceiling, setCeiling] = useState("");
  const [bandRate, setBandRate] = useState("");
  const gross = hourlyGross(Number(hours) || 0, Number(rate) || 0);
  const bonus = collectionBonus(Number(collected) || 0, bands);

  return (
    <ModulePage
      title="שכר"
      description="מבנה הסכם בלבד: שעתי, מדרגות גבייה, או מנהלים. אין שיעורים או שמות שכר בקוד."
      icon={Users}
      emptyTitle="אין הסכמי שכר של שמש במסד"
      emptyBody="shemesh_pay_profiles לא הורצה לייצור. השיעורים מוקלדים במסך לחישוב מקומי ולא נשמרים בריפו."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="שעתי">
          <div className="grid gap-2">
            <input className={field} inputMode="decimal" placeholder="שעות" value={hours} onChange={(event) => setHours(event.target.value)} />
            <input className={field} inputMode="decimal" placeholder="תעריף לשעה" value={rate} onChange={(event) => setRate(event.target.value)} />
          </div>
          <p className="mt-3 text-sm">ברוטו שעתי {formatShemeshMoney(gross)}. נסיעות ופנסיה יחכו למקור שעות.</p>
        </Panel>
        <Panel title="מדרגות גבייה">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={field} inputMode="decimal" placeholder="עד סכום" value={ceiling} onChange={(event) => setCeiling(event.target.value)} />
            <input className={field} inputMode="decimal" placeholder="שיעור, למשל 0.12" value={bandRate} onChange={(event) => setBandRate(event.target.value)} />
          </div>
          <input
            className={`${field} mt-2`}
            inputMode="decimal"
            placeholder="גבייה נטו לחישוב"
            value={collected}
            onChange={(event) => setCollected(event.target.value)}
          />
          <button
            type="button"
            className="mt-2 h-9 rounded-xl bg-primary px-3 text-sm text-primary-foreground"
            onClick={() => {
              const rateValue = Number(bandRate);
              if (!(rateValue > 0)) return;
              setBands((current) => [...current, { ceiling: ceiling ? Number(ceiling) : null, rate: rateValue }]);
              setCeiling("");
              setBandRate("");
            }}
          >
            הוספת מדרגה
          </button>
          <p className="mt-3 text-sm">בונוס {formatShemeshMoney(bonus)} לפי המדרגות שהוקלדו.</p>
        </Panel>
      </div>
    </ModulePage>
  );
}
