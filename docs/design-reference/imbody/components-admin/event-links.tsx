import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CrmPill } from "@/components/admin/crm-pill";
import { MenuField } from "@/components/admin/menu-field";
import { calendarKinds, calendarTone, localInput, type CalendarItem } from "@/lib/admin/calendar-types";
import { createCalendarEvent } from "@/lib/crm/calendar-actions";

export async function EventLinks({
  events,
  locale,
  create,
  kinds,
}: {
  events: CalendarItem[];
  locale: string;
  kinds?: readonly string[];
  create?: {
    customer?: string;
    lead?: string;
    deal?: string;
    ticket?: string;
    order?: string;
    back: string;
    title?: string;
  };
}) {
  const t = await getTranslations();
  const field = "h-10 rounded-full border border-border bg-transparent px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
  const allowed = (kinds ?? calendarKinds).filter((kind) => (calendarKinds as readonly string[]).includes(kind));
  const when = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  });
  return (
    <section className="work-sheet grid gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t("nav.items.calendar")}</h2>
        <Link href="/admin/crm/calendar" className="text-sm text-muted-foreground hover:text-foreground">
          {t("crm.calendar.all")}
        </Link>
      </div>
      {events.length === 0 ? <p className="text-sm text-muted-foreground">{t("crm.calendar.empty")}</p> : null}
      <ul className="grid gap-2">
        {events.map((event) => (
          <li key={event.id}>
            <Link href={event.href} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted px-3 py-2 text-sm hover:bg-muted/70">
              <span className="font-medium">{event.title}</span>
              <CrmPill tone={calendarTone(event.kind)}>{t(`crm.calendar.kinds.${event.kind}`)}</CrmPill>
              <span className="text-muted-foreground">{event.start ? when.format(new Date(event.start)) : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
      {create ? (
        <form action={createCalendarEvent} className="grid gap-2 border-t border-border pt-3">
          <input type="hidden" name="back" value={create.back} />
          {create.customer ? <input type="hidden" name="customer" value={create.customer} /> : null}
          {create.lead ? <input type="hidden" name="lead" value={create.lead} /> : null}
          {create.deal ? <input type="hidden" name="deal" value={create.deal} /> : null}
          {create.ticket ? <input type="hidden" name="ticket" value={create.ticket} /> : null}
          {create.order ? <input type="hidden" name="order" value={create.order} /> : null}
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("crm.calendar.openFrom")}</span>
            <input name="title" required maxLength={160} defaultValue={create.title ?? ""} className={field} />
          </label>
          <MenuField name="kind" label={t("crm.calendar.kind")} value={allowed[0] ?? "meeting"} options={allowed.map((kind) => ({ value: kind, label: t(`crm.calendar.kinds.${kind}`) }))} />
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("crm.calendar.start")}</span>
            <input name="start" type="datetime-local" required defaultValue={localInput(new Date(Date.now() + 3_600_000).toISOString()).slice(0, 16)} dir="ltr" className={`${field} text-start`} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("crm.calendar.end")}</span>
            <input name="end" type="datetime-local" required defaultValue={localInput(new Date(Date.now() + 7_200_000).toISOString()).slice(0, 16)} dir="ltr" className={`${field} text-start`} />
          </label>
          <div>
            <button type="submit" className="press h-10 rounded-full border border-border px-4 text-sm hover:bg-muted">
              {t("crm.save")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
