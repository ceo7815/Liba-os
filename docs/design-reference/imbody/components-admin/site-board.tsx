"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { MenuField } from "@/components/admin/menu-field";
import { PageCubes } from "@/components/admin/page-cubes";
import { cube, row } from "@/lib/admin/page-cubes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { removeSiteItem, saveSiteBanner, saveSiteFaq, saveSitePage, saveSiteRedirect, saveSiteReview } from "@/lib/site/actions";
import type { SiteBanner, SiteFaq, SitePage, SiteRedirect, SiteReview } from "@/lib/site/types";

type Draft =
  | { kind: "page"; item: SitePage }
  | { kind: "faq"; item: SiteFaq }
  | { kind: "review"; item: SiteReview }
  | { kind: "banner"; item: SiteBanner }
  | { kind: "redirect"; item: SiteRedirect };

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground/15";
const areaClass =
  "min-h-28 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground/15";

function freshId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function CopyFields({
  enLabel,
  arLabel,
  en,
  ar,
  multiline,
  onChange,
}: {
  enLabel: string;
  arLabel: string;
  en: string;
  ar: string;
  multiline?: boolean;
  onChange: (side: "en" | "ar", value: string) => void;
}) {
  const Field = multiline ? "textarea" : "input";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        {enLabel}
        <Field dir="ltr" value={en} onChange={(event) => onChange("en", event.target.value)} className={`${multiline ? areaClass : inputClass} text-left`} />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        {arLabel}
        <Field dir="rtl" value={ar} onChange={(event) => onChange("ar", event.target.value)} className={`${multiline ? areaClass : inputClass} text-right`} />
      </label>
    </div>
  );
}

export function SiteBoard({
  kind,
  title,
  lede,
  pages = [],
  faqs = [],
  reviews = [],
  banners = [],
  redirects = [],
}: {
  kind: Draft["kind"];
  title: string;
  lede: string;
  pages?: SitePage[];
  faqs?: SiteFaq[];
  reviews?: SiteReview[];
  banners?: SiteBanner[];
  redirects?: SiteRedirect[];
}) {
  const t = useTranslations("siteDesk");
  const desk = useTranslations("desk");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const canAdd = kind === "faq" || kind === "review" || kind === "redirect";

  const needle = query.trim().toLowerCase();
  const matches = (values: string[]) => !needle || values.join(" ").toLowerCase().includes(needle);
  const visiblePages = useMemo(() => pages.filter((row) => matches([row.path, row.title.en, row.title.ar, row.description.en, row.description.ar])), [needle, pages]);
  const visibleFaqs = useMemo(() => faqs.filter((row) => matches([row.question.en, row.question.ar, row.answer.en, row.answer.ar, row.where])), [faqs, needle]);
  const visibleReviews = useMemo(() => reviews.filter((row) => matches([row.name.en, row.name.ar, row.quote.en, row.quote.ar, String(row.age)])), [needle, reviews]);
  const visibleBanners = useMemo(() => banners.filter((row) => matches([row.id, row.title.en, row.title.ar, row.body.en, row.body.ar])), [banners, needle]);
  const visibleRedirects = useMemo(() => redirects.filter((row) => matches([row.from, row.to])), [needle, redirects]);
  const count = kind === "page" ? visiblePages.length : kind === "faq" ? visibleFaqs.length : kind === "review" ? visibleReviews.length : kind === "banner" ? visibleBanners.length : visibleRedirects.length;

  function openDraft(next: Draft) {
    setDraft(next);
    setError(false);
    setConfirm(false);
  }

  function add() {
    if (kind === "faq") {
      openDraft({ kind, item: { id: freshId("faq"), where: "site", question: { en: "", ar: "" }, answer: { en: "", ar: "" } } });
    }
    if (kind === "review") {
      openDraft({ kind, item: { id: freshId("review"), shown: true, name: { en: "", ar: "" }, age: 30, quote: { en: "", ar: "" } } });
    }
    if (kind === "redirect") {
      openDraft({ kind, item: { id: freshId("redirect"), from: "", to: "", enabled: true } });
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(false);
    const result =
      draft.kind === "page"
        ? await saveSitePage(draft.item)
        : draft.kind === "faq"
          ? await saveSiteFaq(draft.item)
          : draft.kind === "review"
            ? await saveSiteReview(draft.item)
            : draft.kind === "banner"
              ? await saveSiteBanner(draft.item)
              : await saveSiteRedirect(draft.item);
    setSaving(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setDraft(null);
    router.refresh();
  }

  async function remove() {
    if (!draft || draft.kind === "page" || draft.kind === "banner") return;
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setSaving(true);
    const result = await removeSiteItem(draft.kind, draft.item.id);
    setSaving(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setDraft(null);
    router.refresh();
  }

  const countLabel =
    kind === "page"
      ? t("countPages", { count })
      : kind === "faq"
        ? t("countFaqs", { count })
        : kind === "review"
          ? t("countReviews", { count })
          : kind === "banner"
            ? t("countBanners", { count })
            : t("countRedirects", { count });
  const dialogTitle =
    draft?.kind === "page" ? t(`pages.${draft.item.id}`) : draft?.kind === "banner" ? t(draft.item.id) : title;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="console-title text-4xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{lede}</p>
        </div>
        {canAdd ? (
          <Button type="button" onClick={add}>
            {t("add")}
          </Button>
        ) : null}
      </header>
      <PageCubes
        cubes={
          kind === "page"
            ? [
                cube("all", desk("all"), pages.map((item) => row({ id: item.id, title: t(`pages.${item.id}`), detail: item.path }))),
                cube("ar", desk("arabic"), pages.filter((item) => item.title.ar.trim()).map((item) => row({ id: item.id, title: t(`pages.${item.id}`) }))),
                cube("missing", desk("missingAr"), pages.filter((item) => !item.title.ar.trim()).map((item) => row({ id: item.id, title: t(`pages.${item.id}`) }))),
                cube("desc", desk("missingDesc"), pages.filter((item) => !item.description.en.trim() || !item.description.ar.trim()).map((item) => row({ id: item.id, title: t(`pages.${item.id}`) }))),
              ]
            : kind === "faq"
              ? [
                  cube("all", desk("all"), faqs.map((item) => row({ id: item.id, title: item.question.en || item.question.ar }))),
                  cube("site", desk("siteFaqs"), faqs.filter((item) => item.where === "site").map((item) => row({ id: item.id, title: item.question.en || item.question.ar }))),
                  cube("product", desk("productFaqs"), faqs.filter((item) => item.where === "product").map((item) => row({ id: item.id, title: item.question.en || item.question.ar }))),
                  cube("missing", desk("missingAr"), faqs.filter((item) => !item.question.ar.trim()).map((item) => row({ id: item.id, title: item.question.en }))),
                ]
              : kind === "review"
                ? [
                    cube("all", desk("all"), reviews.map((item) => row({ id: item.id, title: item.name.en || item.name.ar }))),
                    cube("shown", desk("shown"), reviews.filter((item) => item.shown).map((item) => row({ id: item.id, title: item.name.en || item.name.ar }))),
                    cube("hidden", desk("hiddenReviews"), reviews.filter((item) => !item.shown).map((item) => row({ id: item.id, title: item.name.en || item.name.ar }))),
                    cube("video", desk("withVideo"), reviews.filter((item) => item.video).map((item) => row({ id: item.id, title: item.name.en || item.name.ar }))),
                  ]
                : kind === "banner"
                  ? [
                      cube("all", desk("all"), banners.map((item) => row({ id: item.id, title: t(item.id) }))),
                      cube("ar", desk("arabic"), banners.filter((item) => item.title.ar.trim()).map((item) => row({ id: item.id, title: t(item.id) }))),
                      cube("missing", desk("missingAr"), banners.filter((item) => !item.title.ar.trim()).map((item) => row({ id: item.id, title: t(item.id) }))),
                      cube("body", desk("missingDesc"), banners.filter((item) => !item.body.en.trim() || !item.body.ar.trim()).map((item) => row({ id: item.id, title: t(item.id) }))),
                    ]
                  : [
                      cube("all", desk("all"), redirects.map((item) => row({ id: item.id, title: item.from, detail: item.to }))),
                      cube("on", desk("enabled"), redirects.filter((item) => item.enabled).map((item) => row({ id: item.id, title: item.from, detail: item.to }))),
                      cube("off", desk("disabled"), redirects.filter((item) => !item.enabled).map((item) => row({ id: item.id, title: item.from, detail: item.to }))),
                      cube("shopify", desk("shopify"), redirects.filter((item) => item.from.includes("/pages/") || item.from.includes("/collections/") || item.from.includes("/blogs/")).map((item) => row({ id: item.id, title: item.from, detail: item.to }))),
                    ]
        }
      />
      <label className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">{t("search")}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{countLabel}</span>
      </label>
      {count === 0 ? <p className="rounded-2xl border border-dashed border-border px-5 py-10 text-sm text-muted-foreground">{t("none")}</p> : null}
      <div className="grid gap-3">
        {kind === "page"
          ? visiblePages.map((row) => (
              <Entry key={row.id} title={t(`pages.${row.id}`)} meta={<bdi className="text-xs text-muted-foreground">{row.path}</bdi>} onOpen={() => openDraft({ kind: "page", item: structuredClone(row) })} edit={t("edit")}>
                <Lang label={t("en")} dir="ltr" text={row.title.en} note={row.description.en} />
                <Lang label={t("ar")} dir="rtl" text={row.title.ar} note={row.description.ar} />
              </Entry>
            ))
          : null}
        {kind === "faq"
          ? visibleFaqs.map((row) => (
              <Entry
                key={row.id}
                title={row.question.en}
                meta={<span className="text-xs text-muted-foreground">{row.where === "site" ? t("site") : t("product")}</span>}
                onOpen={() => openDraft({ kind: "faq", item: structuredClone(row) })}
                edit={t("edit")}
              >
                <Lang label={t("en")} dir="ltr" text={row.question.en} note={row.answer.en} />
                <Lang label={t("ar")} dir="rtl" text={row.question.ar} note={row.answer.ar} />
              </Entry>
            ))
          : null}
        {kind === "review"
          ? visibleReviews.map((row) => (
              <Entry
                key={row.id}
                title={row.name.en}
                quiet={!row.shown}
                meta={
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{t("age")} {row.age}</span>
                    <Pill on={row.shown}>{row.shown ? t("shown") : t("hidden")}</Pill>
                  </span>
                }
                onOpen={() => openDraft({ kind: "review", item: structuredClone(row) })}
                edit={t("edit")}
              >
                <Lang label={t("en")} dir="ltr" text={row.quote.en} />
                <Lang label={t("ar")} dir="rtl" text={row.quote.ar} />
              </Entry>
            ))
          : null}
        {kind === "banner"
          ? visibleBanners.map((row) => (
              <Entry key={row.id} title={t(row.id)} onOpen={() => openDraft({ kind: "banner", item: structuredClone(row) })} edit={t("edit")}>
                <Lang label={t("en")} dir="ltr" text={row.title.en} note={row.body.en} />
                <Lang label={t("ar")} dir="rtl" text={row.title.ar} note={row.body.ar} />
              </Entry>
            ))
          : null}
        {kind === "redirect"
          ? visibleRedirects.map((row) => (
              <Entry
                key={row.id}
                title=""
                quiet={!row.enabled}
                meta={<Pill on={row.enabled}>{row.enabled ? t("enabled") : t("disabled")}</Pill>}
                onOpen={() => openDraft({ kind: "redirect", item: structuredClone(row) })}
                edit={t("edit")}
              >
                <span className="flex flex-wrap items-center gap-3 md:col-span-2">
                  <bdi className="rounded-lg bg-muted px-3 py-2 text-sm">{row.from || "—"}</bdi>
                  <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
                  <bdi className="rounded-lg bg-muted px-3 py-2 text-sm">{row.to || "—"}</bdi>
                </span>
              </Entry>
            ))
          : null}
      </div>

      <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <DialogContent className="flex max-h-[min(44rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-5 py-4 pe-12">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{draft?.kind === "page" ? <bdi>{draft.item.path}</bdi> : lede}</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-4 overflow-y-auto px-5 py-4">
              {draft.kind === "page" ? (
                <>
                  <CopyFields
                    enLabel={`${t("title")} · ${t("en")}`}
                    arLabel={`${t("title")} · ${t("ar")}`}
                    en={draft.item.title.en}
                    ar={draft.item.title.ar}
                    onChange={(side, value) => setDraft({ kind: "page", item: { ...draft.item, title: { ...draft.item.title, [side]: value } } })}
                  />
                  <CopyFields
                    enLabel={`${t("description")} · ${t("en")}`}
                    arLabel={`${t("description")} · ${t("ar")}`}
                    en={draft.item.description.en}
                    ar={draft.item.description.ar}
                    multiline
                    onChange={(side, value) => setDraft({ kind: "page", item: { ...draft.item, description: { ...draft.item.description, [side]: value } } })}
                  />
                </>
              ) : null}
              {draft.kind === "faq" ? (
                <>
                  <label className="grid max-w-xs gap-1.5 text-xs font-medium text-muted-foreground">
                    {t("where")}
                    <MenuField
                      ariaLabel={t("where")}
                      value={draft.item.where}
                      onChange={(value) => setDraft({ kind: "faq", item: { ...draft.item, where: value === "product" ? "product" : "site" } })}
                      options={[
                        { value: "site", label: t("site") },
                        { value: "product", label: t("product") },
                      ]}
                    />
                  </label>
                  <CopyFields
                    enLabel={`${t("question")} · ${t("en")}`}
                    arLabel={`${t("question")} · ${t("ar")}`}
                    en={draft.item.question.en}
                    ar={draft.item.question.ar}
                    onChange={(side, value) => setDraft({ kind: "faq", item: { ...draft.item, question: { ...draft.item.question, [side]: value } } })}
                  />
                  <CopyFields
                    enLabel={`${t("answer")} · ${t("en")}`}
                    arLabel={`${t("answer")} · ${t("ar")}`}
                    en={draft.item.answer.en}
                    ar={draft.item.answer.ar}
                    multiline
                    onChange={(side, value) => setDraft({ kind: "faq", item: { ...draft.item, answer: { ...draft.item.answer, [side]: value } } })}
                  />
                </>
              ) : null}
              {draft.kind === "review" ? (
                <>
                  <div className="flex flex-wrap items-end gap-4">
                    <label className="grid w-28 gap-1.5 text-xs font-medium text-muted-foreground">
                      {t("age")}
                      <input
                        inputMode="numeric"
                        value={String(draft.item.age)}
                        onChange={(event) => setDraft({ kind: "review", item: { ...draft.item, age: Number(event.target.value.replace(/\D/g, "")) || 0 } })}
                        className={inputClass}
                      />
                    </label>
                    <label className="mb-2 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.item.shown}
                        onChange={(event) => setDraft({ kind: "review", item: { ...draft.item, shown: event.target.checked } })}
                      />
                      {t("shown")}
                    </label>
                  </div>
                  <CopyFields
                    enLabel={`${t("name")} · ${t("en")}`}
                    arLabel={`${t("name")} · ${t("ar")}`}
                    en={draft.item.name.en}
                    ar={draft.item.name.ar}
                    onChange={(side, value) => setDraft({ kind: "review", item: { ...draft.item, name: { ...draft.item.name, [side]: value } } })}
                  />
                  <CopyFields
                    enLabel={`${t("quote")} · ${t("en")}`}
                    arLabel={`${t("quote")} · ${t("ar")}`}
                    en={draft.item.quote.en}
                    ar={draft.item.quote.ar}
                    multiline
                    onChange={(side, value) => setDraft({ kind: "review", item: { ...draft.item, quote: { ...draft.item.quote, [side]: value } } })}
                  />
                </>
              ) : null}
              {draft.kind === "banner" ? (
                <>
                  <p className="text-sm font-medium">{t(draft.item.id)}</p>
                  <CopyFields
                    enLabel={`${t("title")} · ${t("en")}`}
                    arLabel={`${t("title")} · ${t("ar")}`}
                    en={draft.item.title.en}
                    ar={draft.item.title.ar}
                    onChange={(side, value) => setDraft({ kind: "banner", item: { ...draft.item, title: { ...draft.item.title, [side]: value } } })}
                  />
                  <CopyFields
                    enLabel={`${t("body")} · ${t("en")}`}
                    arLabel={`${t("body")} · ${t("ar")}`}
                    en={draft.item.body.en}
                    ar={draft.item.body.ar}
                    multiline
                    onChange={(side, value) => setDraft({ kind: "banner", item: { ...draft.item, body: { ...draft.item.body, [side]: value } } })}
                  />
                </>
              ) : null}
              {draft.kind === "redirect" ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      {t("from")}
                      <input
                        dir="ltr"
                        value={draft.item.from}
                        onChange={(event) => setDraft({ kind: "redirect", item: { ...draft.item, from: event.target.value } })}
                        className={`${inputClass} text-left`}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      {t("to")}
                      <input
                        dir="ltr"
                        value={draft.item.to}
                        onChange={(event) => setDraft({ kind: "redirect", item: { ...draft.item, to: event.target.value } })}
                        className={`${inputClass} text-left`}
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.item.enabled}
                      onChange={(event) => setDraft({ kind: "redirect", item: { ...draft.item, enabled: event.target.checked } })}
                    />
                    {t("enabled")}
                  </label>
                  <p className="text-xs text-muted-foreground">{t("redirectHint")}</p>
                </>
              ) : null}
              {error ? <p className="text-sm text-destructive">{t("error")}</p> : null}
            </div>
          ) : null}
          <DialogFooter className="mx-0 mt-auto mb-0 border-t border-border bg-muted/40 px-5 py-3 sm:justify-between">
            {draft && draft.kind !== "page" && draft.kind !== "banner" ? (
              <Button type="button" variant="destructive" disabled={saving} onClick={() => void remove()}>
                {confirm ? t("removeConfirm") : t("remove")}
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Entry({
  title,
  meta,
  edit,
  quiet,
  onOpen,
  children,
}: {
  title: string;
  meta?: ReactNode;
  edit: string;
  quiet?: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group w-full rounded-2xl border border-border bg-card p-5 text-start transition-colors hover:border-foreground/15 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:outline-none ${quiet ? "opacity-60" : ""}`}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          {title ? <span className="block text-lg font-medium tracking-[-0.03em]">{title}</span> : null}
          {meta ? <span className="mt-1 block">{meta}</span> : null}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground">
          {edit}
          <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        </span>
      </span>
      <span className="mt-4 grid gap-3 md:grid-cols-2">{children}</span>
    </button>
  );
}

function Lang({ label, dir, text, note }: { label: string; dir: "ltr" | "rtl"; text: string; note?: string }) {
  return (
    <span className="block rounded-xl bg-muted/70 px-3.5 py-3">
      <span className="block text-[11px] font-medium tracking-wide text-muted-foreground">{label}</span>
      <span dir={dir} className={`mt-1.5 block text-sm leading-relaxed ${dir === "ltr" ? "text-left" : "text-right"}`}>
        {text}
      </span>
      {note ? (
        <span dir={dir} className={`mt-1.5 block text-xs leading-relaxed text-muted-foreground ${dir === "ltr" ? "text-left" : "text-right"}`}>
          {note}
        </span>
      ) : null}
    </span>
  );
}

function Pill({ on, children }: { on: boolean; children: ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${on ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{children}</span>;
}
