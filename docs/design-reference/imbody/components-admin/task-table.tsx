"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CrmName } from "@/components/admin/crm-peek";
import { CrmPill } from "@/components/admin/crm-pill";
import { setWorkTask } from "@/lib/crm/task-list-actions";
import { taskStatuses, type WorkTask } from "@/lib/admin/task-types";

export function TaskTable({
  tasks,
  owners,
}: {
  tasks: WorkTask[];
  owners: Record<string, string>;
}) {
  const t = useTranslations("crm");
  const locale = useLocale();
  const router = useRouter();
  const [rows, setRows] = useState(tasks);
  const [pending, start] = useTransition();

  function when(at: string) {
    const date = new Date(at);
    if (!at || Number.isNaN(date.getTime())) return t("tasks.noDue");
    return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dubai",
    }).format(date);
  }

  useEffect(() => setRows(tasks), [tasks]);

  function done(id: string) {
    const before = rows;
    setRows(rows.map((row) => (row.id === id ? { ...row, status: "completed" } : row)));
    start(async () => {
      const result = await setWorkTask(id, "completed").catch(() => ({ ok: false }));
      if (!result.ok) {
        setRows(before);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="work-sheet overflow-x-auto" aria-busy={pending}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3 text-start font-medium">{t("card.taskTitle")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("tasks.parent")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("status")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("card.due")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("owner")}</th>
            <th className="px-4 py-3 text-start font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((task) => {
            const open = task.status !== "completed" && task.status !== "cancelled";
            return (
              <tr key={task.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 align-top font-medium">{task.title}</td>
                <td className="px-4 py-3 align-top">
                  <CrmName
                    card={{
                      kind: task.parent.kind,
                      id: task.parent.id,
                      number: task.parent.number,
                      name: task.parent.name || t("tasks.untitled"),
                      href: task.parent.href,
                    }}
                    className="crm-name"
                  >
                    <span className="crm-no">{t(`ref.${task.parent.kind}`, { number: task.parent.number })}</span>
                    <span>{task.parent.name || t("tasks.untitled")}</span>
                  </CrmName>
                </td>
                <td className="px-4 py-3 align-top">
                  <CrmPill kind="task" value={task.status}>
                    {taskStatuses.includes(task.status as (typeof taskStatuses)[number]) ? t(`card.taskStatuses.${task.status}`) : task.status}
                  </CrmPill>
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">{when(task.due)}</td>
                <td className="px-4 py-3 align-top">{task.owner ? (owners[task.owner] ?? t("bulk.teammate")) : t("bulk.noOwner")}</td>
                <td className="px-4 py-3 align-top">
                  {open ? (
                    <button type="button" onClick={() => done(task.id)} className="h-9 rounded-full border border-border px-3 text-xs hover:bg-muted">
                      {t("card.done")}
                    </button>
                  ) : (
                    <Link href={task.parent.href} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                      {t("peek.full")}
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
