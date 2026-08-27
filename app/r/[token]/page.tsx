import type { Metadata } from "next";
import { loadSocialReportData } from "@/lib/social-media/report-load";
import { verifySocialReportToken } from "@/lib/social-media/report-token";
import { SocialReportView } from "@/components/social-media/social-report-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: { token: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  const parsed = verifySocialReportToken(decodeURIComponent(params.token));
  if (!parsed) {
    return { title: "דוח תזמון", robots: { index: false, follow: false } };
  }
  return {
    title: `דוח תזמון ${parsed.from}–${parsed.to}`,
    description: "תזמון פוסטים — ליבה ביטוח ופיננסים",
    robots: { index: false, follow: false },
  };
}

export default async function PublicSocialReportPage({ params }: PageProps) {
  const parsed = verifySocialReportToken(decodeURIComponent(params.token));
  if (!parsed) {
    return (
      <section className="mx-auto max-w-lg px-6 py-24 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/liba-logo.png"
          alt="ליבה"
          className="mx-auto h-12 w-auto"
        />
        <h1 className="mt-6 text-xl font-bold text-[#1B2A4A]">הקישור לא תקין</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          בקשו קישור חדש ממערכת הרשתות.
        </p>
      </section>
    );
  }

  const data = await loadSocialReportData(parsed.from, parsed.to);
  return <SocialReportView data={data} shareMode="current-url" />;
}
