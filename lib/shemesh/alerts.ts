import { asRows, isMissingRelation, shemeshAdmin } from "@/lib/shemesh/db";
import { loadCaseBoard, loadSheetQueue } from "@/lib/shemesh/ops";
import { loadSettlementDrafts } from "@/lib/shemesh/settlement-flow";

export type ShemeshAlert = {
  id: string;
  tone: "sun" | "coral" | "teal" | "violet";
  title: string;
  detail: string;
  href: string;
};

function addDays(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

export async function loadShemeshAlerts(): Promise<{ missing: boolean; alerts: ShemeshAlert[] }> {
  const today = todayIso();
  const soon = addDays(today, 7);
  const alerts: ShemeshAlert[] = [];
  const board = await loadCaseBoard().catch(() => null);
  if (!board || board.missing) return { missing: true, alerts: [] };

  for (const item of board.cases) {
    if (item.overdue) {
      alerts.push({
        id: `sla-${item.id}`,
        tone: "coral",
        title: `חריגת SLA · ${item.clientName}`,
        detail: `${item.stageLabel}${item.deadline ? ` · יעד ${item.deadline}` : ""} · ${item.handler || "בלי מטפל"}`,
        href: `/shemesh/cases?open=${item.id}`,
      });
    } else if (item.deadline && item.deadline >= today && item.deadline <= soon && item.status !== "done" && item.status !== "cancelled") {
      alerts.push({
        id: `due-${item.id}`,
        tone: "sun",
        title: `יעד קרוב · ${item.clientName}`,
        detail: `${item.stageLabel} · ${item.deadline}`,
        href: `/shemesh/cases?open=${item.id}`,
      });
    }
    const missingDocs = item.documents.filter((doc) => doc.required && doc.state !== "received" && !doc.received);
    if (missingDocs.length) {
      alerts.push({
        id: `docs-${item.id}`,
        tone: "violet",
        title: `מסמכים חסרים · ${item.clientName}`,
        detail: missingDocs.map((doc) => doc.label).join(" · "),
        href: `/shemesh/cases?open=${item.id}`,
      });
    }
  }

  const queue = await loadSheetQueue().catch(() => ({ missing: false, rows: [] }));
  for (const row of queue.rows) {
    if (!row.openedCaseId && row.excelRowId) {
      alerts.push({
        id: `sheet6-${row.id}`,
        tone: "teal",
        title: `Sheet-6 בלי תיק · ${row.clientName || "בלי שם"}`,
        detail: "השורה ממתינה לפתיחת ליד. אין כאן תאריך איחור אם לא נשמר.",
        href: "/shemesh/gviya",
      });
    }
  }

  try {
    const admin = shemeshAdmin();
    const [excel, surense] = await Promise.all([
      admin.from("shemesh_excel_settings").select("last_error, last_synced_at").limit(1),
      admin.from("shemesh_surense_settings").select("last_error, last_synced_at").limit(1),
    ]);
    const excelRow = asRows(excel.data)[0];
    const surenseRow = asRows(surense.data)[0];
    if (excelRow?.last_error) {
      alerts.push({
        id: "excel-error",
        tone: "coral",
        title: "דוח המכירות של שמש לא סונכרן",
        detail: String(excelRow.last_error),
        href: "/shemesh/sources",
      });
    }
    if (surenseRow?.last_error) {
      alerts.push({
        id: "surense-error",
        tone: "coral",
        title: "סנכרון שורנס נכשל",
        detail: String(surenseRow.last_error),
        href: "/shemesh/agency",
      });
    } else if (surenseRow && !surenseRow.last_synced_at) {
      alerts.push({
        id: "surense-stale",
        tone: "teal",
        title: "שורנס עדיין לא סונכרן",
        detail: "אין חותמת סנכרון שמורה.",
        href: "/shemesh/agency",
      });
    }
  } catch (error) {
    if (!(error instanceof Error) || !isMissingRelation(error.message)) {
      alerts.push({
        id: "source-read",
        tone: "teal",
        title: "חיבורים לא נקראו",
        detail: error instanceof Error ? error.message : "הקריאה נכשלה",
        href: "/shemesh/sources",
      });
    }
  }

  const drafts = await loadSettlementDrafts();
  for (const draft of drafts.drafts) {
    if (draft.status === "draft") {
      alerts.push({
        id: `draft-${draft.id}`,
        tone: "sun",
        title: `טיוטת התחשבנות ${draft.period}`,
        detail: "ממתינה לאישור. הסכומים הם צילום המקורות, בלי מספר שהומצא.",
        href: "/shemesh/settlement",
      });
    }
  }

  return { missing: false, alerts };
}
