"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { adminNav } from "@/lib/admin/nav";
import type { SearchGroup, SearchHit } from "@/lib/admin/search";

const recentKey = "imbody-search-recent";
const kinds: SearchGroup[] = ["leads", "deals", "customers", "orders", "invoices", "products", "tickets", "tasks", "meetings", "conversations", "expenses", "campaigns", "agents"];

function remember(value: string) {
  const next = [value, ...readRecent().filter((item) => item !== value)].slice(0, 6);
  localStorage.setItem(recentKey, JSON.stringify(next));
}

function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function Mark({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter((word) => word.length > 0);
  if (!words.length) return <>{text}</>;
  const pattern = new RegExp(`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  return (
    <>
      {text.split(pattern).map((part, index) =>
        words.some((word) => part.toLowerCase() === word.toLowerCase()) ? (
          <mark key={`${part}-${index}`} className="rounded bg-[#e7f0eb] px-0.5 text-inherit">{part}</mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  products,
  onGo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: { name: string; handle: string }[];
  onGo: (href: string) => void;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [groups, setGroups] = useState<Partial<Record<SearchGroup, SearchHit[]>>>({});
  const screens = useMemo(() => {
    const rows: { href: string; label: string }[] = [];
    for (const group of adminNav) {
      if ("href" in group && group.href) rows.push({ href: group.href, label: t(`nav.groups.${group.key}`) });
      for (const item of group.children) rows.push({ href: item.href, label: t(`nav.items.${item.key}`) });
    }
    return rows;
  }, [t]);
  const actions = [
    { href: "/admin/crm/leads", label: t("shell.actionLead") },
    { href: "/admin/orders?open=1", label: t("shell.actionOrder") },
    { href: "/admin/finance", label: t("shell.actionExpense") },
  ];

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  useEffect(() => {
    const text = query.trim();
    if (!open || text.length < 1) {
      setGroups({});
      return;
    }
    const handle = window.setTimeout(() => {
      void fetch(`/admin/search?q=${encodeURIComponent(text)}`)
        .then((response) => response.json())
        .then((body) => setGroups(body ?? {}))
        .catch(() => setGroups({}));
    }, 120);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  function go(href: string, label?: string) {
    if (query.trim()) remember(query.trim());
    else if (label) remember(label);
    onGo(href);
  }

  const needle = query.trim().toLowerCase();
  const visibleScreens = screens.filter((item) => !needle || item.label.toLowerCase().includes(needle) || item.href.toLowerCase().includes(needle));
  const visibleProducts = products.filter((item) => !needle || `${item.name} ${item.handle}`.toLowerCase().includes(needle));
  const visibleActions = actions.filter((item) => !needle || item.label.toLowerCase().includes(needle));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t("shell.search")} description={t("shell.searchHint")}>
      <CommandInput value={query} onValueChange={setQuery} placeholder={t("shell.searchPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("shell.emptySearch")}</CommandEmpty>
        {!needle && recent.length > 0 ? (
          <CommandGroup heading={t("shell.recent")}>
            {recent.map((item) => (
              <CommandItem key={item} value={`recent ${item}`} onSelect={() => setQuery(item)}>{item}</CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {visibleActions.length > 0 ? (
          <CommandGroup heading={t("shell.actions")}>
            {visibleActions.map((item) => (
              <CommandItem key={item.href} value={`action ${item.label}`} onSelect={() => go(item.href, item.label)}>
                <Mark text={item.label} query={query} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {kinds.map((kind) => {
          const hits = groups[kind] ?? [];
          if (!hits.length) return null;
          return (
            <CommandGroup key={kind} heading={t(`shell.groups.${kind}`)}>
              {hits.map((hit) => (
                <CommandItem key={`${kind}-${hit.href}-${hit.title}`} value={`${kind} ${hit.title} ${hit.detail}`} onSelect={() => go(hit.href, hit.title)}>
                  <span className="min-w-0 flex-1 truncate"><Mark text={hit.title} query={query} /></span>
                  <span className="text-xs text-muted-foreground"><Mark text={hit.detail} query={query} /></span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
        {visibleScreens.length > 0 ? (
          <CommandGroup heading={t("shell.screens")}>
            {visibleScreens.map((item) => (
              <CommandItem key={item.href} value={`screen ${item.label}`} onSelect={() => go(item.href, item.label)}>
                <Mark text={item.label} query={query} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {visibleProducts.length > 0 ? (
          <CommandGroup heading={t("nav.items.products")}>
            {visibleProducts.map((item) => (
              <CommandItem key={item.handle} value={`catalog ${item.name} ${item.handle}`} onSelect={() => go(`/admin/store/products/${item.handle}`, item.name)}>
                <Mark text={item.name} query={query} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
