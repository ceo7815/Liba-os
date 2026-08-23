import type { Profile } from "@/lib/types";

/** Only these accounts may see / use «חשבונות ליבה». Not all admins. */
export const FINANCE_ALLOWED_EMAILS = [
  "ceo@beosystem.com",
  "asaf@liba-fs.co.il",
] as const;

export function canAccessFinance(
  profile: Pick<Profile, "email"> | null | undefined,
): boolean {
  if (!profile?.email) return false;
  const email = profile.email.trim().toLowerCase();
  return (FINANCE_ALLOWED_EMAILS as readonly string[]).includes(email);
}
