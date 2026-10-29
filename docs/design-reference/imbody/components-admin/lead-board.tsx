"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CrmPeek, type PeekCard } from "@/components/admin/crm-peek";
import { CrmPill, type Tone } from "@/components/admin/crm-pill";
import { MenuField } from "@/components/admin/menu-field";
import type { CrmKind } from "@/lib/admin/crm-ref";
import { moveLead } from "@/lib/crm/actions";

export type BoardColumn = { key: string; label: string; tone: Tone };
export type BoardCard = {
  id: string;
  number: number;
  name: string;
  title: string;
  value: string;
  status: string;
  temperature?: string;
  temperatureLabel?: string;
  age: string;
  phone?: string;
  email?: string;
  when?: string;
  owner?: string;
  tags?: string[];
  customerId?: string;
};

export function LeadBoard({
  columns,
  cards,
  labels,
  hrefBase = "/admin/crm/leads",
  kind = "lead",
  onMove = moveLead,
  showTemperature = true,
}: {
  columns: BoardColumn[];
  cards: BoardCard[];
  labels: { move: string; failed: string; empty: string; open: string };
  hrefBase?: string;
  kind?: CrmKind;
  onMove?: (id: string, status: string) => Promise<{ ok: boolean }>;
  showTemperature?: boolean;
}) {
  const t = useTranslations("crm");
  const [items, setItems] = useState(cards);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => setItems(cards), [cards]);
  const [over, setOver] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  function move(id: string, status: string) {
    const before = items;
    const card = before.find((item) => item.id === id);
    if (!card || card.status === status) return;
    setFailed(false);
    setItems(before.map((item) => (item.id === id ? { ...item, status } : item)));
    start(async () => {
      const result = await onMove(id, status);
      if (!result.ok) {
        setItems(before);
        setFailed(true);
      }
    });
  }

  const open = items.find((item) => item.id === openId) ?? null;
  const peek: PeekCard | null = open
    ? {
        kind,
        id: open.id,
        number: open.number,
        name: open.name,
        href: `${hrefBase}/${open.id}`,
        title: open.title,
        statusLabel: columns.find((column) => column.key === open.status)?.label ?? open.status,
        tone: columns.find((column) => column.key === open.status)?.tone,
        phone: open.phone,
        email: open.email,
        owner: open.owner,
        temperature: showTemperature ? open.temperature : undefined,
        temperatureLabel: showTemperature ? open.temperatureLabel : undefined,
        value: open.value,
        when: open.when,
        age: open.age,
        tags: open.tags,
        links: open.customerId ? [{ href: `/admin/crm/customers/${open.customerId}`, label: t("customers.openCard") }] : [],
      }
    : null;

  return (
    <div className="grid gap-3" aria-busy={pending}>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {labels.failed}
        </p>
      ) : null}
      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
        {columns.map((column) => {
          const list = items.filter((item) => item.status === column.key);
          return (
            <section
              key={column.key}
              aria-label={column.label}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(column.key);
              }}
              onDragLeave={() => setOver((current) => (current === column.key ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);
                move(event.dataTransfer.getData("text/plain"), column.key);
              }}
              className={`work-sheet flex w-72 shrink-0 snap-start flex-col gap-2 bg-muted/40 p-2 shadow-none ${over === column.key ? "ring-2 ring-ring/50" : ""}`}
            >
              <header className="flex items-center justify-between px-2 pt-1">
                <CrmPill tone={column.tone}>{column.label}</CrmPill>
                <span className="text-xs tabular-nums text-muted-foreground">{list.length}</span>
              </header>
              {list.length === 0 ? <p className="px-2 py-4 text-xs text-muted-foreground">{labels.empty}</p> : null}
              {list.map((card) => (
                <article
                  key={card.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", card.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  className="grid cursor-grab gap-2 rounded-2xl border border-border bg-card px-3 py-3 text-sm active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenId(card.id)}
                      aria-label={`${labels.open}: ${card.name}`}
                      className="crm-name min-w-0"
                    >
                      <span className="crm-no">{t(`ref.${kind}`, { number: card.number })}</span>
                      <span className="truncate">{card.name}</span>
                    </button>
                    {showTemperature && card.temperature ? (
                      <CrmPill kind="temperature" value={card.temperature}>
                        {card.temperatureLabel}
                      </CrmPill>
                    ) : null}
                  </div>
                  {card.title ? <p className="truncate text-xs text-muted-foreground">{card.title}</p> : null}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{card.age}</span>
                    {card.value ? <bdi className="font-medium text-foreground">{card.value}</bdi> : null}
                  </div>
                  <MenuField
                    ariaLabel={`${labels.move}: ${card.name}`}
                    value={card.status}
                    onChange={(status) => move(card.id, status)}
                    options={columns.map((item) => ({ value: item.key, label: item.label }))}
                  />
                </article>
              ))}
            </section>
          );
        })}
      </div>
      <CrmPeek
        card={peek}
        open={Boolean(open)}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
      />
    </div>
  );
}
