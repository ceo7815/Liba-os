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
    if (item.stage === "lead" && item.status !== "done" && item.status !== "cancelled") {
      alerts.push({
        id: `lead-${item.id}`,
        tone: "sun",
        title: `ליד חדש · ${item.clientName}`,
        detail: `${item.handler || "בלי מטפל"}${item.openedOn ? ` · נפתח ${item.openedOn}` : ""}`,
        href: `/shemesh/cases?open=${item.id}`,
      });
    }
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
  const slaDays = board.settings.slaDays;
  for (const row of queue.rows) {
    if (row.openedCaseId || !row.excelRowId) continue;
    const late = slaDays != null && row.createdAt ? addDays(row.createdAt, slaDays) < today : false;
    alerts.push({
      id: `sheet6-${row.id}`,
      tone: late ? "coral" : "teal",
      title: `${late ? "Sheet-6 באיחור" : "Sheet-6 בלי תיק"} · ${row.clientName || "בלי שם"}`,
      detail: late
        ? `נפתחה ב־${row.createdAt} ועברו ימי ה-SLA השמורים בלי תיק.`
        : slaDays == null
          ? "השורה ממתינה לפתיחת ליד. ימי SLA לא אומתו, ולכן אין כאן סימון איחור."
          : "השורה ממתינה לפתיחת ליד ועדיין בתוך ימי ה-SLA.",
      href: "/shemesh/gviya",
    });
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
    } else if (surenseRow?.last_synced_at) {
      const synced = String(surenseRow.last_synced_at).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(synced) && addDays(synced, 7) < today) {
        alerts.push({
          id: "surense-old",
          tone: "coral",
          title: "סנכרון שורנס התיישן",
          detail: `הסנכרון האחרון ${synced} ישן משבוע.`,
          href: "/shemesh/agency",
        });
      }
    }
    const costs = await admin.from("shemesh_rules").select("id").eq("kind", "cost").eq("active", true).limit(20);
    if (!costs.error && asRows(costs.data).length) {
      alerts.push({
        id: "costs-unpaid",
        tone: "violet",
        title: "הוצאה קבועה בלי רישום תשלום",
        detail: "יש כללי קטלוג פעילים. אין טבלת תשלום בפועל, ולכן אי אפשר לסמן אותן כשולמו.",
        href: "/shemesh/costs",
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
