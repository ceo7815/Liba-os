import { createAdminClient } from "@/lib/supabase/admin";
import { localDemoAdmin, localDemoEnabled, type LocalQuery } from "@/lib/shemesh/local-demo";

export function asRows(data: unknown): Record<string, any>[] {
  return Array.isArray(data) ? data : [];
}

export function shemeshAdmin(): { from: (table: string) => LocalQuery } {
  if (localDemoEnabled()) return localDemoAdmin();
  return createAdminClient() as unknown as { from: (table: string) => LocalQuery };
}

export function isMissingRelation(message: string | undefined): boolean {
  if (!message) return false;
  return (
    /relation .+ does not exist/i.test(message) ||
    /could not find the table/i.test(message) ||
    /schema cache/i.test(message) ||
    /column .+ does not exist/i.test(message)
  );
}

export async function readTable<T>(
  table: string,
  select: string,
): Promise<{ rows: T[]; missing: boolean; error: string | null }> {
  try {
    const admin = shemeshAdmin();
    const { data, error } = await admin.from(table).select(select);
    if (error) {
      if (isMissingRelation(error.message)) return { rows: [], missing: true, error: null };
      return { rows: [], missing: false, error: error.message };
    }
    return { rows: (data ?? []) as T[], missing: false, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "המסד לא זמין";
    if (isMissingRelation(message) || /missing supabase|missing next_public/i.test(message)) {
      return { rows: [], missing: true, error: null };
    }
    return { rows: [], missing: false, error: message };
  }
}
