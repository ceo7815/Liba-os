import { publicErrorText } from "@/lib/sync-log";

/** Why a forced Excel sync must not replace the numbers already on screen. */
export function salesExcelSyncProblem(
  data: { source?: string | null; error?: string | null } | null | undefined,
): string | null {
  if (!data || typeof data !== "object") return "סנכרון האקסל לא החזיר נתונים";
  const error = typeof data.error === "string" ? data.error.trim() : "";
  if (error) return publicErrorText(error);
  if (data.source !== "live") {
    return "דוח המנהלים לא עודכן. הנתונים שכבר על המסך נשארים.";
  }
  return null;
}
