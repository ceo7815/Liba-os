import { getTranslations } from "next-intl/server";
import { approveSiteReview } from "@/lib/site/actions";
import { readSite } from "@/lib/site/live";

export async function ReviewQueue() {
  const t = await getTranslations();
  const waiting = readSite().reviews.filter((review) => !review.shown);
  return (
    <section className="work-sheet mb-5 px-4 py-4">
      <h2 className="text-sm font-semibold">{t("reviewQueue.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("reviewQueue.lede")}</p>
      {waiting.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("reviewQueue.empty")}</p> : null}
      <ul className="mt-3 grid gap-2">
        {waiting.map((review) => (
          <li key={review.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-muted/60 px-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{review.name.en}</p>
              <p className="mt-1 text-sm text-muted-foreground">{review.quote.en}</p>
            </div>
            <form action={approveSiteReview}>
              <input type="hidden" name="id" value={review.id} />
              <button type="submit" className="press h-9 rounded-full bg-primary px-3 text-sm text-primary-foreground">{t("reviewQueue.approve")}</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
