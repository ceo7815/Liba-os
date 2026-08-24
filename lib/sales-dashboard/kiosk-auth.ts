import { timingSafeEqual } from "crypto";
import { getCurrentProfile } from "@/lib/auth";
import { canAccessSalesDashboard } from "@/lib/sales-dashboard/access";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

export function kioskTokenConfigured(): boolean {
  return Boolean(process.env.SALES_TV_KIOSK_TOKEN?.trim());
}

export function kioskTokenMatches(provided: string | null | undefined): boolean {
  const expected = process.env.SALES_TV_KIOSK_TOKEN?.trim();
  const value = provided?.trim();
  if (!expected || !value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isDevKioskOpen(): boolean {
  return process.env.NODE_ENV !== "production" && !kioskTokenConfigured();
}

export async function authorizeSalesDashboardRequest(
  request: Request,
): Promise<boolean> {
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ??
    request.headers.get("x-sales-tv-token") ??
    bearerToken(request);

  if (kioskTokenMatches(token)) return true;

  const profile = await getCurrentProfile();
  if (profile && canAccessSalesDashboard(profile)) return true;

  return isDevKioskOpen();
}

export async function authorizeSalesTvPage(
  token: string | undefined,
): Promise<boolean> {
  if (kioskTokenMatches(token)) return true;
  const profile = await getCurrentProfile();
  if (profile && canAccessSalesDashboard(profile)) return true;
  return isDevKioskOpen();
}
