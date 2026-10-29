"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MenuField } from "@/components/admin/menu-field";
import { saveCatalogProduct, type CatalogState } from "@/lib/catalog/actions";
import type { LiveProduct, LiveStatus } from "@/lib/catalog/types";

const field =
  "min-h-11 w-full rounded-xl border border-black/10 bg-background px-3 text-sm outline-none transition-colors focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-ring/30";
const well = field.replace("bg-background", "bg-card");
const area = `${field} min-h-36 py-3 leading-relaxed`;
const wellArea = `${well} min-h-36 py-3 leading-relaxed`;

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function paragraphs(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function ProductForm({
  mode,
  product,
  galleries,
}: {
  mode: "create" | "edit";
  product: LiveProduct;
  galleries: { handle: string; name: string }[];
}) {
  const t = useTranslations("catalog");
  const [state, action, pending] = useActionState(saveCatalogProduct, {} as CatalogState);
  const [handle, setHandle] = useState(product.handle);
  const [gallery, setGallery] = useState(galleries[0]?.handle ?? "");
  const [status, setStatus] = useState<LiveStatus>(product.status);
  const [price, setPrice] = useState(product.price);
  const [compareAt, setCompareAt] = useState(product.compareAt);
  const [screen, setScreen] = useState(product.screen);
  const [accessoryValue, setAccessoryValue] = useState(product.accessoryValue);
  const [en, setEn] = useState({ name: product.en.name, line: product.en.line, body: product.en.body });
  const [ar, setAr] = useState({ name: product.ar.name, line: product.ar.line, body: product.ar.body });
  const [enDescription, setEnDescription] = useState(product.en.description.join("\n\n"));
  const [arDescription, setArDescription] = useState(product.ar.description.join("\n\n"));
  const [enSpecs, setEnSpecs] = useState(product.en.specs.join("\n"));
  const [arSpecs, setArSpecs] = useState(product.ar.specs.join("\n"));
  const [box, setBox] = useState(product.accessories.map((item) => `${item.en} | ${item.ar}`).join("\n"));

  useEffect(() => {
    if (state.ok) toast(t("saved"));
  }, [state.at, state.ok, t]);

  const percent = compareAt > 0 ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const saving = Math.max(0, compareAt - price);

  const payload = useMemo(
    () => ({
      handle: mode === "create" ? handle : product.handle,
      status,
      price,
      compareAt,
      screen,
      accessoryValue,
      galleryHandle: gallery,
      accessories: lines(box).flatMap((line) => {
        const [enName, arName = ""] = line.split("|");
        const english = enName.trim();
        if (!english) return [];
        return [{ en: english, ar: arName.trim() || english }];
      }),
      en: { ...en, description: paragraphs(enDescription), specs: lines(enSpecs) },
      ar: { ...ar, description: paragraphs(arDescription), specs: lines(arSpecs) },
    }),
    [accessoryValue, ar, arDescription, arSpecs, box, compareAt, en, enDescription, enSpecs, gallery, handle, mode, price, product.handle, screen, status],
  );

  function setPercent(next: number) {
    const safe = Math.max(0, Math.min(90, next));
    setPrice(Math.max(1, Math.round(compareAt * (1 - safe / 100))));
  }

  function setRegular(next: number) {
    const kept = compareAt > 0 ? (compareAt - price) / compareAt : 0;
    setCompareAt(next);
    setPrice(Math.max(1, Math.round(next * (1 - kept))));
  }

  return (
    <form action={action} className="work-sheet mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <a href="/admin/store/products" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {t("back")}
          </a>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            {mode === "create" ? t("add") : product.en.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "edit" && product.status === "active" ? (
            <a
              href={`/products/${product.handle}`}
              className="press inline-flex min-h-11 items-center rounded-full border border-black/15 bg-card px-5 text-sm font-medium hover:bg-foreground hover:text-background"
            >
              {t("view")}
            </a>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="press inline-flex min-h-11 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-60"
          >
            {pending ? t("saving") : t("save")}
          </button>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <section className="mt-8 grid gap-6 border-t border-black/10 pt-8 lg:grid-cols-[1fr_16rem]">
        <div className="grid gap-4">
          {mode === "create" ? (
            <>
              <label className="grid gap-1.5 text-sm">
                {t("handle")}
                <input className={field} value={handle} onChange={(event) => setHandle(event.target.value.toLowerCase())} autoCapitalize="off" spellCheck={false} />
                <span className="text-muted-foreground">{t("handleHelp")}</span>
              </label>
              <div className="grid gap-1.5 text-sm">
                <span>{t("gallery")}</span>
                <MenuField
                  ariaLabel={t("gallery")}
                  shape="field"
                  value={gallery}
                  onChange={setGallery}
                  options={galleries.map((item) => ({ value: item.handle, label: item.name }))}
                />
                <span className="text-muted-foreground">{t("galleryHelp")}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("handle")} <span className="text-foreground">{product.handle}</span>
            </p>
          )}
        </div>
        <div className="grid gap-1.5 text-sm">
          <span>{t("status")}</span>
          <MenuField
            ariaLabel={t("status")}
            shape="field"
            value={status}
            onChange={(value) => setStatus(value === "hidden" ? "hidden" : "active")}
            options={[
              { value: "active", label: t("onSite") },
              { value: "hidden", label: t("hidden") },
            ]}
          />
        </div>
      </section>

      <section className="mt-8 border-t border-black/10 pt-8">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{t("priceTitle")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm">
            {t("regular")}
            <input className={field} inputMode="numeric" value={compareAt || ""} onChange={(event) => setRegular(Number(event.target.value) || 0)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            {t("percent")}
            <input className={field} inputMode="numeric" value={percent} onChange={(event) => setPercent(Number(event.target.value) || 0)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            {t("sale")}
            <input className={field} inputMode="numeric" value={price || ""} onChange={(event) => setPrice(Number(event.target.value) || 0)} />
          </label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("percentHelp")} {saving > 0 ? t("saveAmount", { amount: saving.toLocaleString("en-AE") }) : null}
        </p>
      </section>

      <section className="mt-8 border-t border-black/10 pt-8">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{t("pageTitle")}</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <CopyFields
            title={t("english")}
            name={en.name}
            line={en.line}
            body={en.body}
            description={enDescription}
            specs={enSpecs}
            onName={(value) => setEn({ ...en, name: value })}
            onLine={(value) => setEn({ ...en, line: value })}
            onBody={(value) => setEn({ ...en, body: value })}
            onDescription={setEnDescription}
            onSpecs={setEnSpecs}
            labels={t}
          />
          <div dir="rtl">
            <CopyFields
              title={t("arabic")}
              name={ar.name}
              line={ar.line}
              body={ar.body}
              description={arDescription}
              specs={arSpecs}
              onName={(value) => setAr({ ...ar, name: value })}
              onLine={(value) => setAr({ ...ar, line: value })}
              onBody={(value) => setAr({ ...ar, body: value })}
              onDescription={setArDescription}
              onSpecs={setArSpecs}
              labels={t}
            />
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            {t("screen")}
            <input className={field} value={screen} onChange={(event) => setScreen(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            {t("accessoryValue")}
            <input
              className={field}
              inputMode="numeric"
              value={accessoryValue || ""}
              onChange={(event) => setAccessoryValue(Number(event.target.value) || 0)}
            />
          </label>
        </div>
        <label className="mt-4 grid gap-1.5 text-sm">
          {t("box")}
          <textarea className={area} value={box} onChange={(event) => setBox(event.target.value)} />
          <span className="text-muted-foreground">{t("boxHelp")}</span>
        </label>
      </section>
    </form>
  );
}

function CopyFields({
  title,
  name,
  line,
  body,
  description,
  specs,
  onName,
  onLine,
  onBody,
  onDescription,
  onSpecs,
  labels,
}: {
  title: string;
  name: string;
  line: string;
  body: string;
  description: string;
  specs: string;
  onName: (value: string) => void;
  onLine: (value: string) => void;
  onBody: (value: string) => void;
  onDescription: (value: string) => void;
  onSpecs: (value: string) => void;
  labels: ReturnType<typeof useTranslations<"catalog">>;
}) {
  return (
    <div className="grid gap-4 rounded-2xl bg-background p-4 sm:p-5">
      <p className="text-sm font-semibold tracking-[-0.02em]">{title}</p>
      <label className="grid gap-1.5 text-sm">
        {labels("name")}
        <input className={well} value={name} onChange={(event) => onName(event.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm">
        {labels("line")}
        <input className={well} value={line} onChange={(event) => onLine(event.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm">
        {labels("body")}
        <textarea className={wellArea} value={body} onChange={(event) => onBody(event.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm">
        {labels("description")}
        <textarea className={wellArea} value={description} onChange={(event) => onDescription(event.target.value)} />
        <span className="text-muted-foreground">{labels("descriptionHelp")}</span>
      </label>
      <label className="grid gap-1.5 text-sm">
        {labels("specs")}
        <textarea className={wellArea} value={specs} onChange={(event) => onSpecs(event.target.value)} />
      </label>
    </div>
  );
}
