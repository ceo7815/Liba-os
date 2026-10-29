import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AdminNavKey } from "@/lib/admin/nav";

export async function screenMeta(key: AdminNavKey): Promise<Metadata> {
  const t = await getTranslations("nav.items");
  return { title: t(key) };
}

export async function PendingScreen({ titleKey }: { titleKey: AdminNavKey }) {
  const t = await getTranslations();

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">{t(`nav.items.${titleKey}`)}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("shell.emptyBody")}</p>
    </section>
  );
}
