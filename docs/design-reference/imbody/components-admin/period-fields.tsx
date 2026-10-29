"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MenuField } from "@/components/admin/menu-field";
import { datePeriods, type DatePeriod } from "@/lib/admin/period";

const field = "h-10 rounded-full border border-border bg-transparent px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 text-start";

export function PeriodFields({
  period,
  on,
  month,
  from,
  to,
  today,
  thisMonth,
}: {
  period: DatePeriod;
  on: string;
  month: string;
  from: string;
  to: string;
  today: string;
  thisMonth: string;
}) {
  const t = useTranslations("crm.filters");
  const [current, setCurrent] = useState<DatePeriod>(period);

  return (
    <>
      <MenuField
        name="period"
        label={t("period")}
        value={current}
        onChange={(value) => setCurrent(value as DatePeriod)}
        options={datePeriods.map((item) => ({ value: item, label: t(item === "all" ? "any" : item) }))}
      />
      {current === "day" ? (
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t("on")}</span>
          <input type="date" name="on" defaultValue={on || today} dir="ltr" className={field} />
        </label>
      ) : null}
      {current === "month" ? (
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t("month")}</span>
          <input type="month" name="month" defaultValue={month || thisMonth} dir="ltr" className={field} />
        </label>
      ) : null}
      {current === "range" ? (
        <>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("from")}</span>
            <input type="date" name="from" defaultValue={from || today} dir="ltr" className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("to")}</span>
            <input type="date" name="to" defaultValue={to || today} dir="ltr" className={field} />
          </label>
        </>
      ) : null}
    </>
  );
}
