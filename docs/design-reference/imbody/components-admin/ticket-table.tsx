"use client";

import Link from "next/link";
import { CrmName } from "@/components/admin/crm-peek";
import { CrmPill, type Tone } from "@/components/admin/crm-pill";
import { useTranslations } from "next-intl";

export type TicketTableRow = {
  id: string;
  number: number;
  title: string;
  name: string;
  customerId: string;
  customerNumber: number;
  status: string;
  statusLabel: string;
  tone: Tone;
  priority: string;
  owner: string;
  when: string;
  respondLate: boolean;
  resolveLate: boolean;
};

export function TicketTable({
  tickets,
  empty,
}: {
  tickets: TicketTableRow[];
  empty: string;
}) {
  const t = useTranslations();
  if (tickets.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <section className="work-sheet overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3 text-start font-medium">{t("crm.number")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("crm.title")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("nav.items.customers")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("crm.status")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("crm.tickets.priority")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("crm.owner")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("crm.tickets.sla")}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3">
                <Link href={`/admin/crm/tickets/${ticket.id}`} className="crm-no hover:underline">
                  {t("crm.ref.ticket", { number: ticket.number })}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link href={`/admin/crm/tickets/${ticket.id}`} className="font-medium hover:underline">
                  {ticket.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <CrmName
                  card={{
                    kind: "customer",
                    id: ticket.customerId,
                    number: ticket.customerNumber,
                    name: ticket.name || t("crm.tickets.noName"),
                    href: `/admin/crm/customers/${ticket.customerId}`,
                  }}
                  className="crm-name"
                />
              </td>
              <td className="px-4 py-3">
                <CrmPill tone={ticket.tone}>{ticket.statusLabel}</CrmPill>
              </td>
              <td className="px-4 py-3">
                <CrmPill tone={ticket.priority === "urgent" ? "danger" : ticket.priority === "high" ? "warning" : "neutral"}>
                  {t(`crm.tickets.priorities.${ticket.priority}`)}
                </CrmPill>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{ticket.owner}</td>
              <td className="px-4 py-3">
                {ticket.respondLate || ticket.resolveLate ? (
                  <CrmPill tone="danger">{t("crm.tickets.breached")}</CrmPill>
                ) : (
                  <span className="text-muted-foreground">{ticket.when}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
