import { cache } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

const PROFILE_SELECT = "id, email, full_name, role, is_active, created_at";

async function fetchProfileById(userId: string): Promise<Profile | null> {
  // Service role — no cookie dependency, safe to cache across requests.
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (!data || !data.is_active) return null;
  return data;
}

const getCachedProfileById = unstable_cache(
  fetchProfileById,
  ["liba-profile-by-id"],
  { revalidate: 60 },
);

/**
 * JWT once per request + profile cached ~60s across navigations.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) return null;
  return getCachedProfileById(userId);
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }
  return profile;
}
