import { cache } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";
import {
  canAccessFinance,
  canAccessSettledCommissions,
  canAccessSourcePnl,
} from "@/lib/finance/access";
import { canAccessSalesDashboard } from "@/lib/sales-dashboard/access";
import {
  canManageUsers,
  canViewEmployeeAgreements,
  canViewEmployees,
  hasPermission,
} from "@/lib/permissions/access";
import type { PermissionKey } from "@/lib/permissions/catalog";
import { normalizePermissionKeys } from "@/lib/permissions/catalog";

const PROFILE_SELECT = "id, email, full_name, role, is_active, created_at";

async function fetchPermissionKeys(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profile_permissions")
    .select("permission_key")
    .eq("profile_id", userId)
    .eq("granted", true);
  return (data ?? []).map((row) => String(row.permission_key));
}

async function fetchProfileById(userId: string): Promise<Profile | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (!data || !data.is_active) return null;

  const permissionKeys = await fetchPermissionKeys(userId);
  return { ...data, permissionKeys: normalizePermissionKeys(permissionKeys) };
}

const getCachedProfileById = unstable_cache(
  fetchProfileById,
  ["liba-profile-by-id-v2"],
  { revalidate: 30, tags: ["profiles"] },
);

/**
 * JWT once per request + profile (+ permissions) cached ~30s across navigations.
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

export async function requirePermission(
  key: PermissionKey,
): Promise<Profile> {
  const profile = await requireProfile();
  if (!hasPermission(profile, key)) {
    redirect("/dashboard");
  }
  return profile;
}

export async function requireAnyPermission(
  keys: readonly PermissionKey[],
): Promise<Profile> {
  const profile = await requireProfile();
  if (!keys.some((k) => hasPermission(profile, k))) {
    redirect("/dashboard");
  }
  return profile;
}

/** User management — requires org.users. */
export async function requireAdmin(): Promise<Profile> {
  return requirePermission("org.users");
}

export async function requireFinanceAccess(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canAccessFinance(profile)) {
    redirect("/dashboard");
  }
  return profile;
}

export async function requireSourcePnlAccess(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canAccessSourcePnl(profile)) {
    redirect("/dashboard");
  }
  return profile;
}

export async function requireSettledCommissionsAccess(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canAccessSettledCommissions(profile)) {
    redirect("/dashboard");
  }
  return profile;
}

export async function requireSalesDashboardAccess(): Promise<Profile> {
  const profile = await requireProfile();
  if (!canAccessSalesDashboard(profile)) {
    redirect("/dashboard");
  }
  return profile;
}

export async function requireEmployeesAccess(): Promise<Profile> {
  return requireAnyPermission(["employees.view", "employees.agreements"]);
}

export async function requireEmployeeAgreementsAccess(): Promise<Profile> {
  return requirePermission("employees.agreements");
}

export {
  canAccessFinance,
  canAccessSettledCommissions,
  canAccessSourcePnl,
  canAccessSalesDashboard,
  canManageUsers,
  canViewEmployees,
  canViewEmployeeAgreements,
  hasPermission,
};
