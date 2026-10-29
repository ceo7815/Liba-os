"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

type View = { name: string; query: string };

export function SavedViews({ scope }: { scope: string }) {
  const t = useTranslations("savedViews");
  const pathname = usePathname();
  const params = useSearchParams();
  const [views, setViews] = useState<View[]>([]);
  const [name, setName] = useState("");
  const key = `imbody-views-${scope}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setViews(raw ? (JSON.parse(raw) as View[]) : []);
    } catch {
      setViews([]);
    }
  }, [key]);

  function persist(next: View[]) {
    setViews(next);
    localStorage.setItem(key, JSON.stringify(next));
  }

  function save() {
    const label = name.trim().slice(0, 40);
    const query = params.toString();
    if (!label || !query) return;
    persist([...views.filter((view) => view.name !== label), { name: label, query }].slice(-8));
    setName("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((view) => (
        <a key={view.name} href={`${pathname}?${view.query}`} className="rounded-full bg-muted px-3 py-1 text-xs">
          {view.name}
        </a>
      ))}
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("name")}
        className="h-8 w-36 rounded-full border border-border bg-transparent px-3 text-xs"
        aria-label={t("name")}
      />
      <button type="button" className="press h-8 rounded-full border border-border px-3 text-xs" onClick={save}>
        {t("save")}
      </button>
    </div>
  );
}
