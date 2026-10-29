"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GLOBAL_SYNC_EVENT } from "@/components/layout/global-sync-button";
import { type ControlItem, type ControlLane, type ControlState } from "@/lib/lead-control/rules";
import type { LeadControlSnapshot } from "@/lib/lead-control/load";
import { cn } from "@/lib/utils";

type Board = "leads" | "processes" | "appointment";
type Focus = "overdue" | "all" | "open";

const BOARDS: { id: Board; label: string }[] = [
  { id: "leads", label: "לידים" },
  { id: "processes", label: "תהליכים" },
  { id: "appointment", label: "מינוי סוכן" },
];

const STATE_LABEL: Record<ControlState, string> = {
  overdue: "לא תקין",
  on_time: "בזמן",
  unassigned: "בלי מטפל",
  watching: "במעקב",
  blocked: "חסום",
};

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function formatSyncStamp(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "טרם סונכרן";
  const day = date.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

function formatGap(item: ControlItem, syncedAt: string): string {
  if (item.state === "unassigned") return "ממתין למטפל";
  if (item.state === "watching") return item.rule;
  if (item.state === "blocked") return "ריג'קט, השעון עצור";
  if (!item.deadline) return item.rule;
  const syncedMs = Date.parse(syncedAt);
  const remaining = Number.isFinite(syncedMs) ? Date.parse(item.deadline) - syncedMs : 0;
  const ms = Math.abs(item.state === "overdue" ? item.lateMs : remaining);
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const amount = days >= 2 ? `${days} ימים` : hours >= 1 ? `${hours} שעות` : `${Math.max(1, Math.floor(ms / 60_000))} דקות`;
  return item.state === "overdue" ? `באיחור של ${amount}` : `עוד ${amount}`;
}

function inBoard(item: ControlItem, board: Board): boolean {
  if (board === "leads") return item.kind === "lead";
  if (board === "appointment") return item.lane === "appointment";
  return item.kind === "workflow" && item.lane !== "appointment";
}

function countLane(items: ControlItem[], lane: ControlLane, state?: ControlState): number {
  return items.filter((item) => item.lane === lane && (state == null || item.state === state)).length;
}

export function LeadControlScreen({ snapshot }: { snapshot: LeadControlSnapshot }) {
  const router = useRouter();
  useEffect(() => {
    const onSync = () => router.refresh();
    window.addEventListener(GLOBAL_SYNC_EVENT, onSync);
    return () => window.removeEventListener(GLOBAL_SYNC_EVENT, onSync);
  }, [router]);
  const [board, setBoard] = useState<Board>("leads");
  const [focus, setFocus] = useState<Focus>("overdue");
  const [queue, setQueue] = useState<"all" | "sofia" | "mashi" | "rep">("all");
  const [status, setStatus] = useState("הכל");
  const [person, setPerson] = useState("הכל");
  const [query, setQuery] = useState("");

  const people = useMemo(() => {
    const names = new Set<string>();
    for (const item of snapshot.items) {
      if (item.assignee) names.add(item.assignee);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "he"));
  }, [snapshot.items]);

  const statuses = useMemo(() => {
    const names = new Set<string>();
    for (const item of snapshot.items) {
      if (inBoard(item, board)) names.add(item.status);
    }
    return [...names];
  }, [snapshot.items, board]);

  const rows = useMemo(() => {
    const needle = query.trim();
    return snapshot.items.filter((item) => {
      if (!inBoard(item, board)) return false;
      if (queue !== "all" && item.lane !== queue) return false;
      if (focus === "overdue" && item.state !== "overdue") return false;
      if (focus === "open" && (item.state === "on_time" || item.state === "blocked")) return false;
      if (status !== "הכל" && item.status !== status) return false;
      if (person !== "הכל" && item.assignee !== person) return false;
      if (!needle) return true;
      return `${item.name} ${item.assignee} ${item.number ?? ""} ${item.source} ${item.status}`.includes(needle);
    });
  }, [snapshot.items, board, queue, focus, status, person, query]);

  const leadOverdue = snapshot.items.filter((item) => item.kind === "lead" && item.state === "overdue").length;
  const processOverdue = snapshot.items.filter(
    (item) => item.kind === "workflow" && item.lane !== "appointment" && item.state === "overdue",
  ).length;
  const appointmentOverdue = countLane(snapshot.items, "appointment", "overdue");
  const reps = useMemo(() => {
    const map = new Map<string, { leads: number; processes: number }>();
    for (const item of snapshot.items) {
      if (item.state !== "overdue" || !item.assignee) continue;
      const row = map.get(item.assignee) ?? { leads: 0, processes: 0 };
      if (item.kind === "lead") row.leads += 1;
      else if (item.lane === "rep" || item.lane === "appointment") row.processes += 1;
      map.set(item.assignee, row);
    }
    return [...map.entries()]
      .map(([name, counts]) => ({ name, ...counts, total: counts.leads + counts.processes }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [snapshot.items]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">עבודה</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">בקרת לידים</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            לידים ותהליכים בנפרד, לפי שעון הסטטוס ב־Surense. תהליך הוא ליד שכבר נסגר ומתופעל עד הפקה.
          </p>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          סנכרון אחרון · {formatSyncStamp(snapshot.fetchedAt)}
        </p>
      </header>

      {!snapshot.fetchedAt ? (
        <p className="rounded-xl bg-highlight/30 px-4 py-3 text-sm">
          עדיין אין סנכרון. לחצו על סנכרון מערכת למעלה, והמסך יישאר על התוצאה הזו עד הסנכרון הבא.
        </p>
      ) : null}
      {snapshot.error ? (
        <p className="rounded-xl border border-black/10 bg-card px-4 py-3 text-sm">{snapshot.error}</p>
      ) : null}
      {snapshot.truncated ? (
        <p className="rounded-xl bg-highlight/30 px-4 py-3 text-sm font-semibold">
          הסנכרון נחתך. הרשימה חלקית עד שהסנכרון הבא ממשיך מאותה נקודה.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="לידים לא תקינים" value={leadOverdue} hint="חדש, מעקב, הצעת מחיר, טרם נענה" onClick={() => { setBoard("leads"); setQueue("all"); setFocus("overdue"); setStatus("הכל"); }} />
        <Metric label="תהליכים לא תקינים" value={processOverdue} hint="שיקוף, בקרה, הפקה וחוסרים" onClick={() => { setBoard("processes"); setQueue("all"); setFocus("overdue"); setStatus("הכל"); }} />
        <Metric label="מינוי סוכן באיחור" value={appointmentOverdue} hint="15 ימי עסקים בלי ריג'קט" onClick={() => { setBoard("appointment"); setQueue("all"); setFocus("overdue"); setStatus("הכל"); }} />
        <Metric label="אצל סופיה" value={countLane(snapshot.items, "sofia")} hint={`${countLane(snapshot.items, "sofia", "overdue")} לא תקינים · שיקוף חדש`} onClick={() => { setBoard("processes"); setQueue("sofia"); setFocus("all"); setStatus("הכל"); }} />
        <Metric label="אצל משי" value={countLane(snapshot.items, "mashi")} hint={`${countLane(snapshot.items, "mashi", "overdue")} לא תקינים · בקרה והפקה`} onClick={() => { setBoard("processes"); setQueue("mashi"); setFocus("all"); setStatus("הכל"); }} />
        <Metric label="אצל נציגים בתהליך" value={countLane(snapshot.items, "rep")} hint="חוסרי מוכר, חוסרים חברה, חיתום" onClick={() => { setBoard("processes"); setQueue("rep"); setFocus("all"); setStatus("הכל"); setPerson("הכל"); }} />
      </div>

      {reps.length > 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">נציגים עם חריגות</h2>
          </div>
          <ul className="grid gap-px bg-muted sm:grid-cols-2 xl:grid-cols-4">
            {reps.map((rep) => (
              <li key={rep.name} className="bg-card">
                <button
                  type="button"
                  onClick={() => { setPerson(rep.name); setQueue("all"); setFocus("overdue"); setStatus("הכל"); }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-highlight/15"
                >
                  <span className="truncate text-sm font-semibold">{rep.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {rep.leads} לידים · {rep.processes} תהליכים
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3">
          {BOARDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setBoard(item.id); setQueue("all"); setStatus("הכל"); }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold",
                board === item.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-black/10 sm:block" />
          {(
            [
              ["overdue", "לא תקין"],
              ["open", "פתוח"],
              ["all", "הכל"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFocus(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm",
                focus === id ? "bg-highlight font-semibold" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-black/10 bg-card px-2 py-1.5 text-sm"
          >
            <option value="הכל">כל הסטטוסים</option>
            {statuses.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={person}
            onChange={(event) => setPerson(event.target.value)}
            className="rounded-lg border border-black/10 bg-card px-2 py-1.5 text-sm"
          >
            <option value="הכל">כל המטפלים</option>
            {people.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש שם או מספר"
            className="min-w-40 flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-black/30"
          />
        </div>

        <p className="px-4 pt-3 text-xs text-muted-foreground">{rows.length.toLocaleString("he-IL")} רשומות</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="px-4 py-2 text-start font-medium">מספר</th>
                <th className="px-3 py-2 text-start font-medium">לקוח</th>
                <th className="px-3 py-2 text-start font-medium">סטטוס</th>
                <th className="px-3 py-2 text-start font-medium">מטפל</th>
                <th className="px-3 py-2 text-start font-medium">{board === "leads" ? "מקור" : "סוג"}</th>
                <th className="px-3 py-2 text-start font-medium">נכנס לסטטוס</th>
                <th className="px-3 py-2 text-start font-medium">מצב</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((item) => (
                <tr key={`${item.kind}-${item.id}`} className="border-t border-black/[0.05]">
                  <td className="px-4 py-2.5 tabular-nums">{item.number ?? "—"}</td>
                  <td className="max-w-48 truncate px-3 py-2.5 font-medium">{item.name}</td>
                  <td className="px-3 py-2.5">{item.status}</td>
                  <td className="px-3 py-2.5">{item.assignee || "—"}</td>
                  <td className="max-w-40 truncate px-3 py-2.5 text-muted-foreground">{item.source || "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatWhen(item.openedAt)}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
                        item.state === "overdue" && "bg-highlight",
                        item.state === "on_time" && "bg-muted text-muted-foreground",
                        item.state === "unassigned" && "border border-black/10",
                        (item.state === "watching" || item.state === "blocked") && "bg-muted",
                      )}
                    >
                      {STATE_LABEL[item.state]} · {formatGap(item, snapshot.fetchedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 200 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">מוצגות 200 הרשומות הדחופות. צמצמו לפי סטטוס או מטפל.</p>
        ) : null}
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">אין רשומות בסינון הזה.</p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        הנתונים הם מהסנכרון האחרון. משיכה חדשה רק מכפתור סנכרון מערכת למעלה.
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-card px-4 py-4 text-start hover:border-black/15"
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value.toLocaleString("he-IL")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}
