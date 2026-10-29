"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CrmPill, type Tone } from "@/components/admin/crm-pill";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CrmKind } from "@/lib/admin/crm-ref";

export type PeekCard = {
  kind: CrmKind;
  id: string;
  number: number;
  name: string;
  href: string;
  title?: string;
  statusLabel?: string;
  tone?: Tone;
  phone?: string;
  email?: string;
  owner?: string;
  sourceLabel?: string;
  temperatureLabel?: string;
  temperature?: string;
  value?: string;
  when?: string;
  age?: string;
  tags?: string[];
  extra?: { label: string; value: string }[];
  links?: { href: string; label: string }[];
};

export function CrmPeek({
  card,
  open,
  onOpenChange,
}: {
  card: PeekCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("crm");
  const locale = useLocale();
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <Sheet open={open && Boolean(card)} onOpenChange={onOpenChange}>
      {card ? (
        <SheetContent side="left" dir={dir} className="crm-peek flex h-full w-[min(28rem,100%)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border px-5 py-4">
            <p className="crm-no text-xs text-muted-foreground">{t(`ref.${card.kind}`, { number: card.number })}</p>
            <SheetTitle className="text-2xl tracking-[-0.03em]">{card.name}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">
              {card.statusLabel ? <CrmPill tone={card.tone ?? "neutral"}>{card.statusLabel}</CrmPill> : null}
              {card.temperatureLabel ? (
                <CrmPill kind="temperature" value={card.temperature ?? "warm"}>
                  {card.temperatureLabel}
                </CrmPill>
              ) : null}
              {card.title ? <span>{card.title}</span> : null}
            </SheetDescription>
          </SheetHeader>
          <dl className="grid gap-3 overflow-y-auto px-5 py-4 text-sm">
            {card.phone ? (
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("phone")}</dt>
                <dd>
                  <a href={`tel:${card.phone.replace(/[^0-9+]/g, "")}`} className="hover:underline">
                    <bdi>{card.phone}</bdi>
                  </a>
                </dd>
              </div>
            ) : null}
            {card.email ? (
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("email")}</dt>
                <dd className="break-all">
                  <a href={`mailto:${card.email}`} className="hover:underline">
                    <bdi>{card.email}</bdi>
                  </a>
                </dd>
              </div>
            ) : null}
            {card.owner ? (
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("owner")}</dt>
                <dd>{card.owner}</dd>
              </div>
            ) : null}
            {card.sourceLabel ? (
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("source")}</dt>
                <dd>{card.sourceLabel}</dd>
              </div>
            ) : null}
            {card.value ? (
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("value")}</dt>
                <dd>
                  <bdi>{card.value}</bdi>
                </dd>
              </div>
            ) : null}
            {card.when ? (
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("card.created")}</dt>
                <dd>{card.when}</dd>
              </div>
            ) : null}
            {card.age ? (
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("card.inStatus")}</dt>
                <dd>{card.age}</dd>
              </div>
            ) : null}
            {card.tags && card.tags.length > 0 ? (
              <div className="grid gap-1">
                <dt className="text-xs text-muted-foreground">{t("tags")}</dt>
                <dd className="flex flex-wrap gap-1">
                  {card.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {card.extra?.map((item) => (
              <div key={item.label} className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
            <Link href={card.href} className="press flex h-10 items-center rounded-full bg-primary px-4 text-sm text-primary-foreground">
              {t("peek.full")}
            </Link>
            {card.links?.map((link) => (
              <Link key={link.href} href={link.href} className="flex h-10 items-center rounded-full px-3 text-sm text-muted-foreground hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

export function CrmName({
  card,
  className,
  children,
}: {
  card: PeekCard;
  className?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("crm");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${t("peek.open")}: ${card.name}`} className={className ?? "crm-name"}>
        {children ?? (
          <>
            <span className="crm-no">{t(`ref.${card.kind}`, { number: card.number })}</span>
            <span>{card.name}</span>
          </>
        )}
      </button>
      <CrmPeek card={card} open={open} onOpenChange={setOpen} />
    </>
  );
}
