"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const order = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const t = useTranslations("shell");
  const { theme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const current = order.includes(theme as (typeof order)[number]) ? (theme as (typeof order)[number]) : "system";
  const choices = [
    { id: "light" as const, label: t("themeLight"), Icon: Sun },
    { id: "dark" as const, label: t("themeDark"), Icon: Moon },
    { id: "system" as const, label: t("themeSystem"), Icon: Monitor },
  ];

  return (
    <div className="hidden items-center rounded-full bg-muted p-0.5 sm:flex" role="group" aria-label={t("theme")}>
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          className={`press grid size-8 place-items-center rounded-full ${ready && current === choice.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          aria-pressed={ready && current === choice.id}
          aria-label={choice.label}
          title={choice.label}
          onClick={() => setTheme(choice.id)}
        >
          <choice.Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
