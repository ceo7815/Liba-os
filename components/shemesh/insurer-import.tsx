"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { importInsurerForm } from "@/app/actions/shemesh-connect";
import { field } from "@/lib/shemesh/field";
import { IMPORT_FIELDS, INSURERS } from "@/lib/shemesh/insurer-import";
import { Panel } from "@/components/shemesh/widgets";

const idle = { error: null as string | null, headers: [] as string[], inserted: undefined as number | undefined, skipped: undefined as number | undefined, messages: [] as string[] };

export function InsurerImport({ history }: { history: { id: string; company: string; kind: string; fileName: string; inserted: number; skipped: number; createdAt: string }[] }) {
  const [state, action] = useFormState(importInsurerForm, idle);
  const [fileLabel, setFileLabel] = useState("לא נבחר קובץ");
  const headers = state.headers ?? [];
  return (
    <div className="space-y-3">
      <Panel title="ייבוא מחברת ביטוח">
        <p className="pb-3 text-sm text-muted-foreground">
          אין API ציבורי. מעלים אקסל עמלה או הפקה, או XML של המסלקה, לכל חברה. המיפוי נשמר. ייבוא חוזר של אותה שורה לא מכפיל אותה. העמלה נרשמת לליבה, בעלת הרישיון.
        </p>
        <form action={action} className="grid gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            חברה
            <select className={field} name="company" defaultValue="harel">
              {INSURERS.map((company) => (
                <option key={company.id} value={company.id}>{company.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            קובץ אקסל או XML
            <span className="flex flex-wrap items-center gap-2">
              <input
                className="sr-only"
                name="file"
                type="file"
                accept=".xlsx,.xls,.xml,.csv"
                required
                onChange={(event) => setFileLabel(event.target.files?.[0]?.name || "לא נבחר קובץ")}
              />
              <span className="inline-flex h-9 items-center rounded-xl border border-border bg-muted px-3 text-sm text-foreground">בחירת קובץ</span>
              <span className="text-sm text-foreground">{fileLabel}</span>
            </span>
          </label>
          {headers.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {IMPORT_FIELDS.map((item) => (
                <label key={item.id} className="grid gap-1 text-xs text-muted-foreground">
                  {item.label}
                  <select className={field} name={item.id} defaultValue="">
                    <option value="">לא למפות</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">בפעם הראשונה שומרים בלי מיפוי כדי לראות את העמודות, ואז בוחרים ושומרים שוב.</p>
          )}
          <button type="submit" className="h-9 w-fit rounded-xl bg-primary px-3 text-sm text-primary-foreground">תצוגה וייבוא</button>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.inserted != null ? <p className="text-sm">נכנסו {state.inserted.toLocaleString("he-IL")} · דולגו {state.skipped?.toLocaleString("he-IL")}</p> : null}
          {state.messages?.slice(0, 8).map((message) => (
            <p key={message} className="text-xs text-muted-foreground">{message}</p>
          ))}
        </form>
      </Panel>
      <Panel title="היסטוריית ייבוא">
        {history.length === 0 ? <p className="text-sm text-muted-foreground">עדיין אין ייבוא. בחרו חברה וקובץ, ואז תצוגה וייבוא.</p> : (
          <ul className="space-y-1 text-sm">
            {history.map((row) => (
              <li key={row.id}>{row.company} · {row.kind} · {row.fileName} · נכנסו {row.inserted} · דולגו {row.skipped}</li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
