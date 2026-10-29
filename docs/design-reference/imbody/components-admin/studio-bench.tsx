"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Variant = { id: string; frame: "feed" | "story" | "whatsapp"; text: string };

function compose(input: { product: string; audience: string; channel: string; tone: string; language: string }): Variant[] {
  const product = input.product || "POWER";
  const who = input.audience || "Dubai";
  const lines: Record<string, [string, string, string]> = {
    he: [
      `${product} ל${who}. עשרים דקות בבית, בלי מנוי.`,
      `ראיתם את ${product}? קובעים ביקור באולם.`,
      `שלום, יש ${product} מוכן להתקנה ב${who}.`,
    ],
    en: [
      `${product} for ${who}. Twenty minutes at home, no membership.`,
      `Seen ${product}? Book a showroom visit.`,
      `Hello, ${product} is ready to install for ${who}.`,
    ],
    ar: [
      `${product} لـ ${who}. عشرون دقيقة في البيت، بلا اشتراك.`,
      `شاهدتم ${product}؟ احجزوا زيارة للصالة.`,
      `مرحباً، ${product} جاهز للتركيب لـ ${who}.`,
    ],
  };
  const set = lines[input.language] ?? lines.en;
  const tone = input.tone === "quiet" ? 0 : input.tone === "direct" ? 2 : 1;
  const text = [set[tone % 3], set[(tone + 1) % 3], set[(tone + 2) % 3]];
  const frames: Variant["frame"][] = input.channel === "whatsapp" ? ["whatsapp", "feed", "story"] : input.channel === "story" ? ["story", "feed", "whatsapp"] : ["feed", "story", "whatsapp"];
  return frames.map((frame, index) => ({ id: `${frame}-${index}`, frame, text: text[index] }));
}

export function StudioBench({
  products,
  history,
  save,
}: {
  products: { handle: string; name: string }[];
  history: { id: string; product: string | null; caption: string }[];
  save: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("studioDesk");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [product, setProduct] = useState(products[0]?.name ?? "");
  const [audience, setAudience] = useState("");
  const [channel, setChannel] = useState("feed");
  const [tone, setTone] = useState("warm");
  const [language, setLanguage] = useState("he");

  return (
    <div className="grid gap-4">
      <form
        className="work-sheet grid gap-3 px-4 py-4 md:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setVariants(compose({
            product: String(data.get("product") ?? ""),
            audience: String(data.get("audience") ?? ""),
            channel: String(data.get("channel") ?? "feed"),
            tone: String(data.get("tone") ?? "warm"),
            language: String(data.get("language") ?? "he"),
          }));
        }}
      >
        <label className="grid gap-1 text-sm">{t("product")}
          <select name="product" value={product} onChange={(event) => setProduct(event.target.value)} className="h-10 rounded-xl border border-border bg-transparent px-2">
            {products.map((item) => <option key={item.handle} value={item.name}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">{t("audience")}<input name="audience" value={audience} onChange={(event) => setAudience(event.target.value)} className="h-10 rounded-xl border border-border bg-transparent px-3" placeholder={t("audienceHint")} /></label>
        <label className="grid gap-1 text-sm">{t("channel")}
          <select name="channel" value={channel} onChange={(event) => setChannel(event.target.value)} className="h-10 rounded-xl border border-border bg-transparent px-2">
            <option value="feed">{t("frames.feed")}</option>
            <option value="story">{t("frames.story")}</option>
            <option value="whatsapp">{t("frames.whatsapp")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">{t("tone")}
          <select name="tone" value={tone} onChange={(event) => setTone(event.target.value)} className="h-10 rounded-xl border border-border bg-transparent px-2">
            <option value="warm">{t("tones.warm")}</option>
            <option value="quiet">{t("tones.quiet")}</option>
            <option value="direct">{t("tones.direct")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">{t("language")}
          <select name="language" value={language} onChange={(event) => setLanguage(event.target.value)} className="h-10 rounded-xl border border-border bg-transparent px-2">
            <option value="he">עברית</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
        <button type="submit" className="h-10 rounded-full bg-primary px-4 text-sm text-primary-foreground md:col-span-5 md:w-fit">{t("generate")}</button>
      </form>
      {variants.length === 0 ? (
        <div className="work-sheet px-6 py-12 text-center">
          <p className="font-medium">{t("purpose")}</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{t("purposeBody")}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {variants.map((variant) => (
            <article key={variant.id} className="work-sheet grid gap-3 px-4 py-4">
              <p className="text-xs text-muted-foreground">{t(`frames.${variant.frame}`)}</p>
              <div className={variant.frame === "story" ? "mx-auto grid h-64 w-36 place-items-end rounded-[1.5rem] bg-[#1d4333] p-3 text-white" : variant.frame === "whatsapp" ? "rounded-2xl bg-[#e7f6ec] px-3 py-3 text-[#102a1f]" : "aspect-[4/5] rounded-2xl bg-[#f4f4f2] p-4"}>
                <p className="text-sm" dir={language === "en" ? "ltr" : "rtl"}>{variant.text}</p>
              </div>
              <form action={save}>
                <input type="hidden" name="product" value={product} />
                <input type="hidden" name="caption" value={variant.text} />
                <button type="submit" className="h-9 rounded-full border border-border px-3 text-sm">{t("save")}</button>
              </form>
            </article>
          ))}
        </div>
      )}
      <section>
        <h2 className="text-sm font-semibold">{t("history")}</h2>
        {history.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p> : (
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {history.map((row) => (
              <li key={row.id} className="work-sheet px-4 py-3 text-sm">
                {row.product ? <p className="text-xs font-semibold text-primary">{row.product}</p> : null}
                <p className="mt-1">{row.caption}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
