import type { Metadata } from "next";
import { AgencyScreen } from "@/components/shemesh/agency-screen";
import { loadShemeshSurenseView } from "@/lib/shemesh/surense-view";
import { loadSheetQueue } from "@/lib/shemesh/ops";
import { SheetQueue } from "@/components/shemesh/sheet-queue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "שורנס · שמש" };

export default async function Page() {
  const [view, queue] = await Promise.all([loadShemeshSurenseView(), loadSheetQueue()]);
  return (
    <div className="space-y-4">
      <AgencyScreen missing={view.missing} error={view.error} rows={view.rows} />
      <SheetQueue
        title="הצלבה · תיק לפי מזהה שורנס"
        body="נפתח תיק אחד לכל surense_id. אם התיק כבר קיים, הלחיצה רק מקשרת ולא משכפלת."
        rows={queue.rows.filter((row) => row.surenseId)}
        missing={queue.missing}
      />
    </div>
  );
}
