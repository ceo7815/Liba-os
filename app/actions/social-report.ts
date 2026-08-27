"use server";

import { headers } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import { loadSocialReportData } from "@/lib/social-media/report-load";
import { signSocialReportToken } from "@/lib/social-media/report-token";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidReportRange(from: string, to: string) {
  if (!DATE.test(from) || !DATE.test(to)) return false;
  if (from > to) return false;
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  const days = (b - a) / 86_400_000;
  return days >= 0 && days <= 92;
}

function publicOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (env) return env;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return getSiteUrl().replace(/\/+$/, "");
}

export async function getSocialReport(from: string, to: string) {
  await requireProfile();
  if (!isValidReportRange(from, to)) {
    return { ok: false as const, error: "טווח תאריכים לא תקין" };
  }
  const data = await loadSocialReportData(from, to);
  return { ok: true as const, data };
}

export async function createSocialReportLink(from: string, to: string) {
  await requireProfile();
  if (!isValidReportRange(from, to)) {
    return { ok: false as const, error: "טווח תאריכים לא תקין" };
  }
  try {
    const token = signSocialReportToken(from, to);
    const origin = publicOrigin();
    if (!origin) {
      return { ok: false as const, error: "לא הצלחנו לבנות כתובת לשיתוף" };
    }
    return {
      ok: true as const,
      url: `${origin}/r/${token}`,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "יצירת הקישור נכשלה",
    };
  }
}
