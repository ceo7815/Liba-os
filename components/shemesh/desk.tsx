"use client";

import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { ClipboardList } from "lucide-react";
import { ShemeshEmpty } from "@/components/shemesh/empty-state";
import { Panel, ShemeshPage } from "@/components/shemesh/widgets";
import { field } from "@/components/shemesh/module-shell";
import { formatShemeshMoney } from "@/lib/shemesh/format";
import type { DeskRow } from "@/lib/shemesh/ops";

const idle = { error: null as string | null };

export function ShemeshDesk({
  title,
  description,
  rows,
  missing,
  error,
  audit,
  exportKind,
  createAction,
  statusAction,
  children,
}: {
  title: string;
  description: string;
  rows: DeskRow[];
  missing: boolean;
  error: string | null;
  audit: { id: string; summary: string; createdAt: string }[];
  exportKind: string;
  createAction: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
  statusAction?: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"title" | "when" | "amount">("when");
  const [state, formAction] = useFormState(createAction, idle);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (status && row.status !== status) return false;
      if (!needle) return true;
      return `${row.title} ${row.subtitle} ${row.assignee}`.toLowerCase().includes(needle);
    });
    next.sort((a, b) => {
      if (sort === "amount") return (b.amount ?? 0) - (a.amount ?? 0);
      if (sort === "title") return a.title.localeCompare(b.title, "he");
      return b.when.localeCompare(a.when);
    });
    return next;
  }, [query, rows, sort, status]);

  return (
    <ShemeshPage title={title} description={description} icon={ClipboardList}>
      {missing || error ? (
        <ShemeshEmpty
          icon={ClipboardList}
          title={error ? "הנתונים לא נקראו" : "הטבלה עדיין לא הורצה"}
          body={error ?? "המיגרציה ממתינה לאישור. המסך יידלק ברגע שהטבלה קיימת. אין כאן סכום קבוע."}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${field} max-w-xs`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש" aria-label="חיפוש" />
            <select className={field} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="סטטוס">
              <option value="">כל הסטטוסים</option>
              <option value="open">פתוח</option>
              <option value="waiting">ממתין</option>
              <option value="done">הושלם</option>
              <option value="cancelled">בוטל</option>
            </select>
            <select className={field} value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="מיון">
              <option value="when">לפי תאריך</option>
              <option value="title">לפי שם</option>
              <option value="amount">לפי סכום</option>
            </select>
            <a className="text-sm font-medium text-highlight" href={`/api/shemesh/export?kind=${exportKind}`}>
              ייצוא לאקסל
            </a>
          </div>
          <Panel title="רשומה חדשה">
            <form action={formAction} className="grid gap-2 sm:grid-cols-2">
              {children}
              {state.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
              <button type="submit" className="h-9 rounded-xl bg-primary px-3 text-sm text-primary-foreground sm:col-span-2">
                שמירה
              </button>
            </form>
          </Panel>
          <Panel title={`${visible.length.toLocaleString("he-IL")} רשומות`}>
            <ul className="divide-y divide-border text-sm">
              {visible.slice(0, 80).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {row.title}
                      {row.overdue ? <span className="ms-2 text-xs text-destructive">חריגת SLA</span> : null}
                    </p>
                    <p className="truncate text-muted-foreground">
                      {row.subtitle}
                      {row.assignee ? ` · ${row.assignee}` : ""}
                      {row.when ? ` · ${row.when}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{row.amount == null ? "—" : formatShemeshMoney(row.amount)}</span>
                    {statusAction ? <StatusForm id={row.id} status={row.status} action={statusAction} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          {audit.length ? (
            <Panel title="יומן">
              <ul className="space-y-1 text-sm text-muted-foreground">
                {audit.map((item) => (
                  <li key={item.id}>{item.summary}</li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      )}
    </ShemeshPage>
  );
}

function StatusForm({
  id,
  status,
  action,
}: {
  id: string;
  status: string;
  action: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [state, formAction] = useFormState(action, idle);
  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} className="h-8 rounded-lg border border-input bg-card px-2 text-xs" aria-label="שינוי סטטוס">
        <option value="open">פתוח</option>
        <option value="waiting">ממתין</option>
        <option value="done">הושלם</option>
        <option value="cancelled">בוטל</option>
      </select>
      <button type="submit" className="h-8 rounded-lg bg-muted px-2 text-xs">עדכון</button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
