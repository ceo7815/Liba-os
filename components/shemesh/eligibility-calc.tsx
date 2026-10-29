"use client";

import { useState } from "react";
import { formatIls } from "@/lib/format/numbers";
import { formatShemeshRate } from "@/lib/shemesh/format";
import { feeFromReceived } from "@/lib/shemesh/lifecycle";

/** Fee stays empty until the named rate is saved and no longer pending. */
export function EligibilityCalc({
  label,
  rate,
  pending,
  defaultReceived,
}: {
  label: string;
  rate: number | null;
  pending: boolean;
  defaultReceived: number | null;
}) {
  const [raw, setRaw] = useState(defaultReceived == null ? "" : String(defaultReceived));
  const [editing, setEditing] = useState(false);
  const parsed = raw.trim() === "" ? null : Number(raw.replace(/[^\d.-]/g, ""));
  const received = parsed != null && Number.isFinite(parsed) ? parsed : null;
  const result = feeFromReceived(received, rate, pending);
  const shown = editing || received == null ? raw : formatIls(received);

  return (
    <div className="mt-3 rounded-2xl border border-white/80 bg-white/70 px-3 py-3">
      <p className="text-xs font-semibold">מחשבון זכאות · {label}</p>
      <label className="mt-2 grid gap-1 text-xs text-muted-foreground">
        סכום שהתקבל
        <input
          value={shown}
          inputMode="decimal"
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onChange={(event) => setRaw(event.target.value.replace(/[^\d.-]/g, ""))}
          className="h-10 rounded-xl border border-white/80 bg-white px-3 text-sm text-foreground"
        />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        שיעור שמור: {pending || rate == null ? "ממתין לאימות" : formatShemeshRate(rate)}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">שכר טרחה {formatIls(result.fee)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">הסכום שהוקלד לא נשמר. בלי שיעור מאומת אין שכר טרחה.</p>
    </div>
  );
}
