import type { Metadata } from "next";
import Link from "next/link";
import { getSocialReport } from "@/app/actions/social-report";
import { SocialReportView } from "@/components/social-media/social-report-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "דוח תזמון",
};

type PageProps = {
  searchParams: { from?: string; to?: string };
};

export default async function SocialReportPage({ searchParams }: PageProps) {
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";
  const result = await getSocialReport(from, to);

  if (!result.ok) {
    return (
      <section className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">לא ניתן להציג את הדוח</h1>
        <p className="mt-2 text-sm text-muted-foreground">{result.error}</p>
        <Link
          href="/agents/social-media"
          className="mt-6 inline-block text-sm font-medium underline underline-offset-4"
        >
          חזרה ליומן
        </Link>
      </section>
    );
  }

  return (
    <SocialReportView
      data={result.data}
      shareMode="create-link"
      backHref="/agents/social-media"
    />
  );
}
