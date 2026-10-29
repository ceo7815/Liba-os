import { publicErrorText } from "@/lib/sync-log";

const FAILED = new Set(["failed", "partial", "cancelled"]);

/** Hebrew line for an agent run the operator should see. Null when the run did not fail. */
export function agentRunErrorHe(
  status: string | null | undefined,
  errorMessage: string | null | undefined,
): string | null {
  if (!status || !FAILED.has(status)) return null;
  const text = (errorMessage ?? "").trim();
  if (!text) {
    if (status === "failed") return "ההרצה נכשלה בלי פירוט.";
    if (status === "cancelled") return "ההרצה בוטלה.";
    return "ההרצה הסתיימה חלקית.";
  }
  if (/stale: running|נתקעה יותר משעה/i.test(text)) {
    return "ההרצה נתקעה יותר משעה בלי לסיים.";
  }
  return publicErrorText(text);
}
