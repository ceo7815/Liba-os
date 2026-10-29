"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Panel } from "@/components/shemesh/widgets";
import { ModulePage } from "@/components/shemesh/module-shell";
import { formatShemeshCount } from "@/lib/shemesh/format";
import type { ShemeshSurenseRow } from "@/lib/shemesh/surense-view";

export function AgencyScreen({
  missing,
  error,
  rows,
}: {
  missing: boolean;
  error: string | null;
  rows: ShemeshSurenseRow[];
}) {
  const [mode, setMode] = useState<"same" | "separate">("same");
  return (
    <ModulePage
      title="נתוני שורנס"
      description="לידים ותהליכים מהצילום האחרון, מסוננים למקורות ולמטפלים של שמש. בלי כתיבה לשורנס."
      icon={Building2}
      emptyTitle={missing ? "צילום שורנס לא זמין" : rows.length === 0 ? "אין רשומות שמש בצילום" : "מסונן מהצילום הקיים"}
      emptyBody={
        error
          ? error
          : missing
            ? "lead_control_snapshots לא נקראה. אחרי סנכרון המערכת הרשימה תופיע בלי מיגרציה חדשה."
            : mode === "same"
              ? "מצב: אותה סוכנות. מוצגים רק מקורות שמש מתוך הצילום של ליבה."
              : "מצב: סוכנות נפרדת. עד שיוגדר חיבור נוסף, אין משיכה שנייה."
      }
    >
      <Panel title="מצב סוכנות">
        <div className="flex gap-2">
          {(["same", "separate"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`h-9 rounded-full px-4 text-sm ${mode === item ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {item === "same" ? "אותה סוכנות" : "סוכנות נפרדת"}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{formatShemeshCount(rows.length)} רשומות שמש בצילום.</p>
      </Panel>
      <Panel title="רשומות">
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">אין מה להציג עד שצילום שורנס יכלול מקור או מטפל של שמש.</p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-auto text-sm">
            {rows.slice(0, 80).map((row) => (
              <li key={row.id} className="flex justify-between gap-3 border-b border-border py-1.5">
                <span className="truncate font-medium">{row.name || "בלי שם"}</span>
                <span className="shrink-0 text-muted-foreground">{row.kind} · {row.source || row.assignee}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </ModulePage>
  );
}
