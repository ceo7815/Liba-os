"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, Upload } from "lucide-react";
import { ShemeshEmpty } from "@/components/shemesh/empty-state";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, ShemeshPage, Stat } from "@/components/shemesh/widgets";
import { formatShemeshCount, formatShemeshMoney, formatShemeshMonth } from "@/lib/shemesh/format";
import type { TaxRow } from "@/lib/shemesh/tax-refunds";

export function TaxRefundsScreen({
  fileName,
  rows,
  statuses,
}: {
  fileName: string | null;
  rows: TaxRow[];
  statuses: string[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const filtered = rows.filter((row) => status === "all" || row.status === status);
  const amount = filtered.reduce((sum, row) => sum + row.amount, 0);
  const open = filtered.filter((row) => !/נסגר|הושלם|נגבה|שולם/.test(row.status)).length;
  const byStatus = useMemo(() => {
    const groups = new Map<string, number>();
    for (const row of rows) groups.set(row.status, (groups.get(row.status) ?? 0) + 1);
    return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const months = useMemo(() => {
    const groups = new Map<string, number>();
    for (const row of rows) {
      if (!row.month) continue;
      groups.set(row.month, (groups.get(row.month) ?? 0) + row.amount);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  }, [rows]);
  const max = Math.max(1, ...months.map((row) => row[1]));

  async function upload(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/shemesh/tax-refunds", { method: "POST", body });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "ההעלאה נכשלה");
      toast.success("דוח החזרי המס נשמר");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההעלאה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShemeshPage
      title="החזרי מס"
      description={fileName ? `מתוך ${fileName}. אין חיבור אוטומטי לתיקייה עד שמעלים את הדוח.` : "דוח החזרי המס עדיין לא הועלה."}
      icon={Scale}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          {statuses.length ? (
            <select
              className="h-9 rounded-xl border border-black/10 bg-white px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="סטטוס"
            >
              <option value="all">כל הסטטוסים</option>
              {statuses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          ) : null}
          <label className="inline-flex cursor-pointer items-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} asChild>
              <span>{busy ? "מעלה…" : rows.length ? "החלפת דוח" : "העלאת דוח"}</span>
            </Button>
          </label>
        </div>
      }
      stats={
        rows.length
          ? (
            <>
              <Stat label="תיקים" value={formatShemeshCount(filtered.length)} />
              <Stat label="סכום בדוח" value={formatShemeshMoney(amount)} />
              <Stat label="פתוחים" value={formatShemeshCount(open)} hint="בלי סטטוס סגירה" />
              <Stat label="ממוצע" value={filtered.length ? formatShemeshMoney(amount / filtered.length) : "—"} />
            </>
          )
          : undefined
      }
    >
      {rows.length === 0 ? (
        <ShemeshEmpty
          icon={Upload}
          title="עוד אין דוח החזרי מס"
          body="העלו את הקובץ מתיקיית שמש תפעול, ב־Excel או CSV. הוא נשמר כמו דוח המכירות, בלי טבלה חדשה. עד אז המסך נשאר ריק בכוונה."
          action={
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = "";
                }}
              />
              <Button type="button" disabled={busy} asChild>
                <span>{busy ? "מעלה…" : "העלאת דוח"}</span>
              </Button>
            </label>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="צינור לפי סטטוס">
              <ul className="space-y-2">
                {byStatus.map(([label, count]) => (
                  <li key={label} className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className="tabular-nums text-muted-foreground">{formatShemeshCount(count)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="סכום לפי חודש">
              {months.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">אין עמודת תאריך בדוח.</p>
              ) : (
                <div className="flex items-end gap-2 py-2">
                  {months.map(([month, value]) => (
                    <div key={month} className="flex min-w-12 flex-1 flex-col items-center gap-1">
                      <div className="flex h-24 w-full items-end">
                        <div className="w-full rounded-t-lg bg-[#185A94]" style={{ height: `${Math.max(8, (value / max) * 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{formatShemeshMonth(month)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
          <Panel title="שורות">
            <div className="max-h-[24rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 text-right font-medium">שם</th>
                    <th className="py-2 text-right font-medium">סטטוס</th>
                    <th className="py-2 text-right font-medium">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((row) => (
                    <tr key={row.id} className="border-t border-black/[0.06]">
                      <td className="py-2 font-medium">{row.name}</td>
                      <td className="py-2">{row.status}</td>
                      <td className="py-2 tabular-nums">{formatShemeshMoney(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </ShemeshPage>
  );
}
