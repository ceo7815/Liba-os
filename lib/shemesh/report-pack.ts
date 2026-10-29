import { asRows, isMissingRelation, shemeshAdmin } from "@/lib/shemesh/db";
import { buildGviyaModel, groupDeals } from "@/lib/shemesh/gviya";
import { CASE_STAGES, caseStatusLabel } from "@/lib/shemesh/catalog";
import { loadShemeshPulse } from "@/lib/shemesh/load-pulse";
import { sliceAds } from "@/lib/shemesh/pulse";
import { countTaxPipeline, TAX_PIPELINE } from "@/lib/shemesh/lifecycle";
import { loadCaseBoard, loadSheetQueue, loadTaxStatuses } from "@/lib/shemesh/ops";
import { loadShemeshSalesWorkbook } from "@/lib/shemesh/sales-workbook-store";
import { SHEMESH_SALES_SOURCE_LABEL } from "@/lib/shemesh/sales-source";
import { loadSettlementDrafts, SETTLEMENT_STATUS_LABEL } from "@/lib/shemesh/settlement-flow";
import { loadShemeshBooks } from "@/lib/shemesh/story";

export type ReportSheet = { name: string; rows: Record<string, string | number | null>[] };

function note(text: string): Record<string, string | number | null>[] {
  return [{ הערה: text }];
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

/** Remaining spend at the current daily pace. No budget is assumed. */
export function spendForecast(spend: number, daysElapsed: number, daysInMonth: number): number | null {
  if (spend <= 0 || daysElapsed <= 0 || daysInMonth <= 0) return null;
  const left = Math.max(0, daysInMonth - daysElapsed);
  return Math.round((spend / daysElapsed) * left * 100) / 100;
}

export function agingBucket(days: number): string {
  if (days < 0) return "עתידי";
  if (days <= 30) return "0–30";
  if (days <= 60) return "31–60";
  if (days <= 90) return "61–90";
  return "90+";
}

function daysSince(iso: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const start = Date.parse(`${iso}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86400000);
}

function cycleBucket(days: number): string {
  if (days <= 7) return "0–7";
  if (days <= 14) return "8–14";
  if (days <= 30) return "15–30";
  if (days <= 60) return "31–60";
  return "60+";
}

export async function buildShemeshReportPack(): Promise<ReportSheet[]> {
  const today = todayIso();
  const stored = await loadShemeshSalesWorkbook().catch(() => null);
  const model = buildGviyaModel(stored);
  const hasWorkbook = model.deals.length > 0;

  const sold = hasWorkbook
    ? model.deals.map((deal) => ({
        לקוח: deal.client,
        מטפל: deal.rep,
        מקור: deal.source,
        שירות: CASE_STAGES.find((stage) => stage.id === deal.stage)?.label ?? deal.stage,
        "תאריך עסקה": deal.dealDate,
        סכום: deal.dealAmount,
        נגבה: deal.collected,
        ימים: deal.cycleDays,
        מקור_קובץ: SHEMESH_SALES_SOURCE_LABEL,
      }))
    : note(`אין ייבוא של ${SHEMESH_SALES_SOURCE_LABEL}. הגיליון לא ממלא מספרים מתיקים.`);

  const openDeals = model.deals.filter((deal) => deal.dealAmount > deal.collected && deal.dealDate);
  const aging = openDeals.length
    ? openDeals.map((deal) => {
        const age = daysSince(deal.dealDate ?? "", today);
        return {
          לקוח: deal.client,
          "תאריך עסקה": deal.dealDate,
          פתוח: deal.dealAmount - deal.collected,
          ימים: age,
          סל: age == null ? "" : agingBucket(age),
        };
      })
    : note(hasWorkbook ? "אין יתרה פתוחה בדוח שמש." : "אין ייבוא של דוח המכירות, ולכן אין גיול.");

  const cycles = model.deals.filter((deal) => deal.cycleDays != null);
  const histogram = new Map<string, number>();
  for (const deal of cycles) histogram.set(cycleBucket(deal.cycleDays ?? 0), (histogram.get(cycleBucket(deal.cycleDays ?? 0)) ?? 0) + 1);
  const cycleRows = histogram.size
    ? [...histogram.entries()].map(([bucket, count]) => ({ סל: bucket, עסקאות: count }))
    : note(hasWorkbook ? "אין ימי מחזור בדוח." : "אין ייבוא של דוח המכירות, ולכן אין היסטוגרמה.");

  const tax = await loadTaxStatuses().catch(() => ({ missing: true, statuses: [] as Array<string | null> }));
  const taxCounts = countTaxPipeline(tax.statuses);
  const taxRows = tax.missing
    ? note("טבלת החזרי המס עדיין לא נקראה.")
    : TAX_PIPELINE.map((item) => ({ סטטוס: item.label, תיקים: taxCounts[item.id] }));

  let costRows: Record<string, string | number | null>[] = note("אין כללי הוצאה קבועה.");
  let insurerRows: Record<string, string | number | null>[] = note("אין שורות מבטחים.");
  try {
    const admin = shemeshAdmin();
    const [rules, insurers] = await Promise.all([
      admin.from("shemesh_rules").select("title, amount, active, cadence").eq("kind", "cost").limit(200),
      admin.from("shemesh_insurer_rows").select("company, policy_ref, client_name, commission, premium, produced_on").limit(500),
    ]);
    if (!rules.error && asRows(rules.data).length) {
      costRows = asRows(rules.data).map((row) => ({
        כותרת: String(row.title ?? ""),
        סכום_קטלוג: row.amount == null ? null : Number(row.amount),
        פעיל: row.active ? "כן" : "לא",
        תדירות: String(row.cadence ?? ""),
        שולם: "אין רישום תשלום בפועל",
      }));
    } else if (rules.error && isMissingRelation(rules.error.message)) {
      costRows = note("טבלת הכללים עדיין לא הורצה.");
    }
    if (!insurers.error && asRows(insurers.data).length) {
      insurerRows = asRows(insurers.data).map((row) => ({
        חברה: String(row.company ?? ""),
        פוליסה: String(row.policy_ref ?? ""),
        לקוח: String(row.client_name ?? ""),
        פרמיה: row.premium == null ? null : Number(row.premium),
        עמלה: row.commission == null ? null : Number(row.commission),
        תאריך: String(row.produced_on ?? ""),
        הערה: "העמלה שייכת לליבה",
      }));
    }
  } catch {
    costRows = note("הכללים לא נקראו.");
  }

  const books = await loadShemeshBooks().catch(() => null);
  const soldMonth = hasWorkbook ? model.deals.reduce((sum, deal) => sum + deal.collected, 0) : null;
  const pnl: Record<string, string | number | null>[] = [
    { שורה: "נגבה בדוח שמש", סכום: soldMonth, מקור: hasWorkbook ? SHEMESH_SALES_SOURCE_LABEL : "אין ייבוא" },
    {
      שורה: "שכר טרחה בספר",
      סכום: books && !books.missing ? books.collectedNet : null,
      מקור: "ספר תפעול, לא דוח המכירות",
    },
    { שורה: "הוצאות קבועות", סכום: books && !books.missing ? books.monthCost : null, מקור: "ספר תפעול" },
    { שורה: "שכר", סכום: books && !books.missing ? books.monthPayroll : null, מקור: "ספר תפעול" },
    { שורה: "עמלת מטפל", סכום: books && !books.missing ? books.monthCommission : null, מקור: "ספר תפעול" },
    { שורה: "החזר חוב", סכום: books && !books.missing ? books.monthDebt : null, מקור: "ספר תפעול" },
    { שורה: "עמלת רישיון של ליבה", סכום: books && !books.missing ? books.licenseCommission : null, מקור: "ליבה" },
  ];

  const drafts = await loadSettlementDrafts();
  for (const draft of drafts.drafts) {
    pnl.push({
      שורה: `התחשבנות ${draft.period} · ${SETTLEMENT_STATUS_LABEL[draft.status]}`,
      סכום: draft.streams[0]?.amount,
      מקור: draft.note || "טיוטת ההתחשבנות. גבייה בחשבון ליבה נשארת ריקה בלי ייבוא בנק.",
    });
  }
  const settlementRows = drafts.missing
    ? note("טבלת טיוטות ההתחשבנות עדיין לא הורצה.")
    : drafts.drafts.length
      ? drafts.drafts.map((draft) => ({
          תקופה: draft.period,
          סטטוס: SETTLEMENT_STATUS_LABEL[draft.status],
          "עמלות ליבה": draft.streams[0]?.amount,
          "שורות עמלה": draft.streams[0]?.rows ?? 0,
          "פרמיית ביטוח": draft.streams[1]?.amount,
          "גבייה בחשבון ליבה": draft.streams[2]?.amount,
        }))
      : note("אין טיוטות שמורות.");

  const board = await loadCaseBoard().catch(() => null);
  const slaRows: Record<string, string | number | null>[] = !board || board.missing
    ? note("התיקים לא נקראו.")
    : board.cases.filter((item) => item.overdue).map((item) => ({
        לקוח: item.clientName,
        שלב: item.stageLabel,
        מטפל: item.handler,
        יעד: item.deadline,
        סטטוס: caseStatusLabel(item.status),
      }));
  if (slaRows.length === 0) slaRows.push({ הערה: "אין חריגות SLA." });

  const queue = await loadSheetQueue().catch(() => ({ missing: true, rows: [] as Awaited<ReturnType<typeof loadSheetQueue>>["rows"] }));
  const opened = queue.rows.filter((row) => row.openedCaseId).length;
  const waiting = queue.rows.length - opened;
  const sheet6 = queue.missing
    ? note("תור Sheet-6 לא נקרא.")
    : queue.rows.length
      ? [
          { לקוח: "סיכום", "מזהה שורה": "", נפתח: "כן", כמות: opened },
          { לקוח: "סיכום", "מזהה שורה": "", נפתח: "לא", כמות: waiting },
          ...queue.rows.map((row) => ({
            לקוח: row.clientName,
            "מזהה שורה": row.excelRowId,
            נפתח: row.openedCaseId ? "כן" : "לא",
            כמות: 1,
          })),
        ]
      : note("אין שורות בתור.");

  const byRep = hasWorkbook
    ? groupDeals(model.deals, "rep").map((row) => ({ מטפל: row.key, עסקאות: row.count, נמכר: row.sold, נגבה: row.collected }))
    : note("אין ייבוא של דוח המכירות.");
  const bySource = hasWorkbook
    ? groupDeals(model.deals, "source").map((row) => ({ מקור: row.key, עסקאות: row.count, נמכר: row.sold, נגבה: row.collected }))
    : note("אין ייבוא של דוח המכירות.");
  const byService = new Map<string, { count: number; sold: number; collected: number }>();
  for (const deal of model.deals) {
    const label = CASE_STAGES.find((stage) => stage.id === deal.stage)?.label ?? deal.stage;
    const current = byService.get(label) ?? { count: 0, sold: 0, collected: 0 };
    current.count += 1;
    current.sold += deal.dealAmount;
    current.collected += deal.collected;
    byService.set(label, current);
  }
  const serviceRows = hasWorkbook
    ? [...byService.entries()].map(([label, row]) => ({ שירות: label, עסקאות: row.count, נמכר: row.sold, נגבה: row.collected }))
    : note("אין ייבוא של דוח המכירות.");

  const pulse = await loadShemeshPulse().catch(() => null);
  const monthStart = `${today.slice(0, 7)}-01`;
  const daysInMonth = Number(monthEndDay(today.slice(0, 7)));
  const daysElapsed = Number(today.slice(8, 10));
  const ads = pulse ? sliceAds(pulse, { from: monthStart, to: today, channel: "all" }) : null;
  const marketing = !ads || (ads.spend === 0 && ads.leads === 0)
    ? note("אין סנכרון קמפיינים לחודש. הוצאה, לידים ועלות לליד יישארו ריקים.")
    : [
        ...ads.byCampaign.map((row) => ({
          קמפיין: row.name,
          ערוץ: row.channel === "facebook" ? "פייסבוק" : "גוגל",
          הוצאה: row.spend,
          לידים: row.leads,
          "עלות לליד": row.cpl,
          מצטבר: row.spend,
          תחזית: spendForecast(row.spend, daysElapsed, daysInMonth),
          הערה: "התחזית היא קצב יומי כפול הימים שנותרו. אין תקציב שמור להשוואה.",
        })),
        {
          קמפיין: "סה״כ",
          ערוץ: "",
          הוצאה: ads.spend,
          לידים: ads.leads,
          "עלות לליד": ads.cpl,
          מצטבר: ads.spend,
          תחזית: spendForecast(ads.spend, daysElapsed, daysInMonth),
          הערה: "התחזית היא קצב יומי כפול הימים שנותרו. אין תקציב שמור להשוואה.",
        },
      ];

  return [
    { name: "נמכר לפי תאריך", rows: sold },
    { name: "נמכר לפי מטפל", rows: byRep },
    { name: "נמכר לפי מקור", rows: bySource },
    { name: "נמכר לפי שירות", rows: serviceRows },
    { name: "גיול גבייה", rows: aging },
    { name: "מחזור", rows: cycleRows },
    { name: "משפך מס", rows: taxRows },
    { name: "שיווק", rows: marketing },
    { name: "הוצאות קבועות", rows: costRows },
    { name: "עמלות מבטחים", rows: insurerRows },
    { name: "רווח והפסד", rows: pnl },
    { name: "התחשבנות", rows: settlementRows },
    { name: "חריגות SLA", rows: slaRows },
    { name: "תפוקת Sheet-6", rows: sheet6 },
  ];
}

function monthEndDay(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function assertAgingBuckets(): void {
  if (agingBucket(0) !== "0–30" || agingBucket(31) !== "31–60" || agingBucket(91) !== "90+") {
    throw new Error("aging buckets drifted");
  }
  if (spendForecast(300, 10, 30) !== 600) throw new Error("forecast must be daily pace times days left");
  if (spendForecast(0, 10, 30) !== null) throw new Error("empty spend has no forecast");
}

assertAgingBuckets();
