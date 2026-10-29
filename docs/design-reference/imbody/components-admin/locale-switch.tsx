"use client";

import { useLocale, useTranslations } from "next-intl";
import { setAdminLocale } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function LocaleSwitch({ tone = "photo" }: { tone?: "photo" | "console" }) {
  const locale = useLocale();
  const t = useTranslations("locale");
  const next = locale === "he" ? "en" : "he";
  const className =
    tone === "photo"
      ? "press min-h-11 bg-transparent px-3 text-[15px] font-medium tracking-[0.04em] text-white/75 hover:bg-white/10 hover:text-white"
      : "press min-h-11 bg-transparent px-3 text-[15px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <form action={setAdminLocale}>
      <input type="hidden" name="locale" value={next} />
      <Button type="submit" variant="ghost" size="sm" aria-label={`${t("label")}: ${t("switchTo")}`} className={className}>
        {t("code")}
      </Button>
    </form>
  );
}
