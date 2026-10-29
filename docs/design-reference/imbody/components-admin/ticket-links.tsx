import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CrmName } from "@/components/admin/crm-peek";
import { CrmPill } from "@/components/admin/crm-pill";
import { MenuField } from "@/components/admin/menu-field";
import { statusLabel, statusTone, type CrmStatus } from "@/lib/admin/crm-config";
import { ticketPriorities, type TicketRow } from "@/lib/admin/tickets";
import { createTicket } from "@/lib/crm/ticket-actions";

export async function TicketLinks({
  tickets,
  statuses,
  locale,
  create,
}: {
  tickets: TicketRow[];
  statuses: CrmStatus[];
  locale: string;
  create?: {
    customer: string;
    order?: string;
    lead?: string;
    deal?: string;
    conversation?: string;
    back: string;
    title?: string;
  };
}) {
  const t = await getTranslations();
  const field = "h-10 rounded-full border border-border bg-transparent px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
  return (
    <section className="work-sheet grid gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t("nav.items.tickets")}</h2>
        {tickets.length > 0 ? (
          <Link href="/admin/crm/tickets" className="text-sm text-muted-foreground hover:text-foreground">
            {t("crm.tickets.all")}
          </Link>
        ) : null}
      </div>
      {tickets.length === 0 ? <p className="text-sm text-muted-foreground">{t("crm.tickets.empty.all")}</p> : null}
      <ul className="grid gap-2">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <CrmName
              card={{
                kind: "ticket",
                id: ticket.id,
                number: ticket.number,
                name: ticket.title || t("crm.tickets.noName"),
                href: `/admin/crm/tickets/${ticket.id}`,
                statusLabel: statusLabel(statuses, ticket.status, locale),
                tone: statusTone(statuses, ticket.status),
              }}
              className="crm-name flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted px-3 py-2 text-sm hover:bg-muted/70"
            >
              <span className="crm-no">{t("crm.ref.ticket", { number: ticket.number })}</span>
              <span className="font-medium">{ticket.title}</span>
              <CrmPill tone={statusTone(statuses, ticket.status)}>{statusLabel(statuses, ticket.status, locale)}</CrmPill>
              <CrmPill tone={ticket.priority === "urgent" ? "danger" : ticket.priority === "high" ? "warning" : "neutral"}>
                {t(`crm.tickets.priorities.${ticket.priority}`)}
              </CrmPill>
              {ticket.respondLate || ticket.resolveLate ? <CrmPill tone="danger">{t("crm.tickets.breached")}</CrmPill> : null}
            </CrmName>
          </li>
        ))}
      </ul>
      {create ? (
        <form action={createTicket} className="grid gap-2 border-t border-border pt-3">
          <input type="hidden" name="customer" value={create.customer} />
          <input type="hidden" name="back" value={create.back} />
          {create.order ? <input type="hidden" name="order" value={create.order} /> : null}
          {create.lead ? <input type="hidden" name="lead" value={create.lead} /> : null}
          {create.deal ? <input type="hidden" name="deal" value={create.deal} /> : null}
          {create.conversation ? <input type="hidden" name="conversation" value={create.conversation} /> : null}
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("crm.tickets.openFrom")}</span>
            <input name="title" required maxLength={160} defaultValue={create.title ?? ""} placeholder={t("crm.tickets.titleHint")} className={field} />
          </label>
          <MenuField name="priority" label={t("crm.tickets.priority")} value="normal" options={ticketPriorities.map((item) => ({ value: item, label: t(`crm.tickets.priorities.${item}`) }))} />
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
