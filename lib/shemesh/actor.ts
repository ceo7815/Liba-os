import { getCurrentProfile } from "@/lib/auth";
import { canManageShemesh } from "@/lib/permissions/access";
import { LOCAL_DEMO_PROFILE, localDemoEnabled } from "@/lib/shemesh/local-demo";
import type { Profile } from "@/lib/types";

export async function shemeshProfile(): Promise<Profile | null> {
  try {
    const profile = await getCurrentProfile();
    if (profile) return profile;
  } catch {
    // A local demo has no Supabase session.
  }
  return localDemoEnabled() ? LOCAL_DEMO_PROFILE : null;
}

export async function shemeshManageActor(): Promise<string | null> {
  const profile = await shemeshProfile();
  if (!profile || !canManageShemesh(profile)) return null;
  return profile.full_name || profile.email || profile.id;
}
