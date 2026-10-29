"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CrmPeek, type PeekCard } from "@/components/admin/crm-peek";
import { CrmPill, type Tone } from "@/components/admin/crm-pill";

export type TableCustomer = {
  id: string;
  number: number;
  name: string;
  phone: string;
  email: string;
  statusLabel: string;
  tone: Tone;
  contactOnly: boolean;
  owner: string;
  orders: string;
  spent: string;
  since: string;
  tags: string[];
};

export function CustomerTable({
  customers,
  empty,
}: {
  customers: TableCustomer[];
  empty: string;
}) {
  const t = useTranslations("crm");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = customers.find((row) => row.id === openId) ?? null;
  const peek: PeekCard | null = open
    ? {
        kind: "customer",
        id: open.id,
        number: open.number,
        name: open.name,
        href: `/admin/crm/customers/${open.id}`,
        statusLabel: open.contactOnly ? t("customers.contactOnly") : open.statusLabel,
        tone: open.contactOnly ? "neutral" : open.tone,
        phone: open.phone,
        email: open.email,
        owner: open.owner,
        when: open.since,
        tags: open.tags,
        extra: [
          { label: t("customers.orders"), value: open.orders },
          { label: t("customers.spent"), value: open.spent },
        ],
      }
    : null;

  return (
    <section className="work-sheet overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3 text-start font-medium">{t("number")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("name")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("contact")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("status")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("owner")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("customers.orders")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("customers.spent")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("customers.since")}</th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : null}
          {customers.map((customer) => (
            <tr key={customer.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3 align-top">
                <button type="button" onClick={() => setOpenId(customer.id)} className="crm-no hover:underline">
                  {t("ref.customer", { number: customer.number })}
                </button>
              </td>
              <td className="px-4 py-3 align-top">
                <button type="button" onClick={() => setOpenId(customer.id)} className="crm-name" aria-label={`${t("peek.open")}: ${customer.name}`}>
                  {customer.name}
                </button>
                {customer.tags.length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {customer.tags.map((item) => (
                      <span key={item} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {item}
                      </span>
                    ))}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 align-top">
                {customer.phone ? (
                  <span className="block">
                    <bdi>{customer.phone}</bdi>
                  </span>
                ) : null}
                {customer.email ? (
                  <span className="block break-all text-muted-foreground">
                    <bdi>{customer.email}</bdi>
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 align-top">
                {customer.contactOnly ? (
                  <span className="text-muted-foreground">{t("customers.contactOnly")}</span>
                ) : (
                  <CrmPill tone={customer.tone}>{customer.statusLabel}</CrmPill>
                )}
              </td>
              <td className="px-4 py-3 align-top">{customer.owner}</td>
              <td className="px-4 py-3 align-top tabular-nums">{customer.orders}</td>
              <td className="px-4 py-3 align-top tabular-nums">
                <bdi>{customer.spent}</bdi>
              </td>
              <td className="px-4 py-3 align-top text-muted-foreground">{customer.since}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <CrmPeek card={peek} open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpenId(null); }} />
    </section>
  );
}
