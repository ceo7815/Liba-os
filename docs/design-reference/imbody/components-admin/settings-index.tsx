"use client";

import { useState } from "react";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Globe,
  Languages,
  MapPin,
  MessageCircle,
  Receipt,
  ScrollText,
  Search,
  ShoppingBag,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type SettingSection = {
  id: string;
  title: string;
  detail: string;
  href?: string;
  fields: { label: string; value: string }[];
};

const icons = {
  store: Store,
  users: Users,
  payments: CreditCard,
  checkout: ShoppingBag,
  shipping: Truck,
  tax: Receipt,
  languages: Languages,
  policies: ScrollText,
  notices: Bell,
  domain: Globe,
  places: MapPin,
  channels: MessageCircle,
} as const;

export function SettingsIndex({ sections }: { sections: SettingSection[] }) {
  const t = useTranslations("settings");
  const title = useTranslations("nav.items")("settings");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const rows = sections.filter((section) => {
    if (!needle) return true;
    const haystack = [section.title, section.detail, ...section.fields.flatMap((field) => [field.label, field.value])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
  const open = sections.find((section) => section.id === openId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header>
        <h1 className="text-4xl font-semibold tracking-[-0.04em]">{title}</h1>
      </header>
      <label className="work-sheet flex h-12 items-center gap-3 px-4">
        <Search className="size-4 text-muted-foreground" />
        <span className="sr-only">{t("search")}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div className="work-sheet overflow-hidden">
        {rows.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground">{t("empty")}</p> : null}
        <ul>
          {rows.map((section) => {
            const Icon = icons[section.id as keyof typeof icons] ?? Store;
            return (
              <li key={section.id} className="border-t border-black/10 first:border-t-0">
                <button type="button" onClick={() => setOpenId(section.id)} className="press flex w-full items-center gap-4 px-4 py-3 text-start">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium tracking-[-0.02em]">{section.title}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">{section.detail}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <Dialog open={open !== null} onOpenChange={(next) => { if (!next) setOpenId(null); }}>
        <DialogContent className="max-h-[min(40rem,calc(100%-2rem))] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-[-0.03em]">{open?.title}</DialogTitle>
            <DialogDescription>{open?.detail}</DialogDescription>
          </DialogHeader>
          <dl className="grid gap-4">
            {open?.fields.map((field) => (
              <div key={`${field.label}-${field.value}`}>
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="mt-1 text-sm">{field.value}</dd>
              </div>
            ))}
          </dl>
          {open?.href ? (
            <a href={open.href} className="mt-2 inline-flex rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
              {t("open")}
            </a>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
