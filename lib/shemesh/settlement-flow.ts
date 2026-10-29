import { asRows, isMissingRelation, shemeshAdmin } from "@/lib/shemesh/db";
import { loadInsurerSettlement } from "@/lib/shemesh/connector-store";
import { currentMonthKey } from "@/lib/shemesh/gviya";
import { loadShemeshLibaSettlement } from "@/lib/shemesh/liba-settlement";

const ORDER = ["draft", "approved", "paid"] as const;
export type SettlementStatus = (typeof ORDER)[number];

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  draft: "טיוטה",
  approved: "אושר",
  paid: "שולם",
};

/** One step only: draft → approved → paid. */
export function settlementMoveAllowed(from: string, to: string): boolean {
  const current = ORDER.indexOf(from as SettlementStatus);
  const next = ORDER.indexOf(to as SettlementStatus);
  if (current < 0 || next < 0) return false;
  return next === current + 1;
}

export type SettlementStream = {
  id: "liba_commission" | "insurance_sales" | "redemption_in_liba";
  label: string;
  amount: number | null;
  rows: number;
  note: string;
};

export type SettlementDraft = {
  id: string;
  period: string;
  status: SettlementStatus;
  streams: SettlementStream[];
  note: string;
};

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loadSettlementStreams(): Promise<SettlementStream[]> {
  const [imported, liba] = await Promise.all([
    loadInsurerSettlement(),
    loadShemeshLibaSettlement().catch(() => ({ missing: true, error: "דוח ליבה לא נקרא", sales: [], premium: 0, owed: null })),
  ]);
  const knownCommission = imported.rows.filter((row) => row.commission != null);
  const commission = knownCommission.reduce((sum, row) => sum + (row.commission ?? 0), 0);
  const insuranceReady = !liba.missing && !liba.error && liba.sales.length > 0;
  return [
    {
      id: "liba_commission",
      label: "עמלות שנסגרו בליבה",
      amount: imported.missing || knownCommission.length === 0 ? null : commission,
      rows: imported.missing ? 0 : knownCommission.length,
      note: imported.missing || knownCommission.length === 0
        ? "אין שורות עמלה מקבצי החברות."
        : "העמלה שייכת לליבה, בעלת הרישיון. לא הומצא סכום.",
    },
    {
      id: "insurance_sales",
      label: "מכירות ביטוח על שמש",
      amount: insuranceReady ? liba.premium : null,
      rows: insuranceReady ? liba.sales.length : 0,
      note: insuranceReady
        ? "שורות שמש בדוח המנהלים של ליבה, כמו כל עצמאי."
        : "אין שורות ביטוח של שמש בדוח ליבה.",
    },
    {
      id: "redemption_in_liba",
      label: "גביית פדיון בחשבון ליבה",
      amount: null,
      rows: 0,
      note: "אין ייבוא של כניסה לחשבון ליבה. ספר שכר הטרחה לא נספר כאן.",
    },
  ];
}

function streamsFromRow(row: Record<string, unknown>): SettlementStream[] {
  return [
    {
      id: "liba_commission",
      label: "עמלות שנסגרו בליבה",
      amount: num(row.liba_commission),
      rows: Number(row.liba_rows ?? 0),
      note: "צילום בעת שמירת הטיוטה.",
    },
    {
      id: "insurance_sales",
      label: "מכירות ביטוח על שמש",
      amount: num(row.insurance_premium),
      rows: Number(row.insurance_rows ?? 0),
      note: "צילום בעת שמירת הטיוטה.",
    },
    {
      id: "redemption_in_liba",
      label: "גביית פדיון בחשבון ליבה",
      amount: num(row.redemption_collected),
      rows: Number(row.redemption_rows ?? 0),
      note: "צילום בעת שמירת הטיוטה.",
    },
  ];
}

export async function loadSettlementDrafts(): Promise<{ missing: boolean; error: string | null; drafts: SettlementDraft[] }> {
  try {
    const admin = shemeshAdmin();
    const { data, error } = await admin.from("shemesh_settlement_drafts").select("*").order("created_at", { ascending: false }).limit(40);
    if (error) {
      if (isMissingRelation(error.message)) return { missing: true, error: null, drafts: [] };
      return { missing: false, error: error.message, drafts: [] };
    }
    return {
      missing: false,
      error: null,
      drafts: asRows(data).map((row) => ({
        id: String(row.id),
        period: String(row.period ?? ""),
        status: (ORDER.includes(row.status) ? row.status : "draft") as SettlementStatus,
        streams: streamsFromRow(row),
        note: String(row.note ?? ""),
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "הטיוטות לא נקראו";
    return { missing: isMissingRelation(message), error: isMissingRelation(message) ? null : message, drafts: [] };
  }
}

export async function createSettlementDraft(actor: string, sourceRef = ""): Promise<{ error: string | null }> {
  const streams = await loadSettlementStreams();
  const byId = Object.fromEntries(streams.map((stream) => [stream.id, stream]));
  try {
    const admin = shemeshAdmin();
    const { error } = await admin.from("shemesh_settlement_drafts").insert({
      period: currentMonthKey(),
      status: "draft",
      liba_commission: byId.liba_commission.amount,
      insurance_premium: byId.insurance_sales.amount,
      redemption_collected: byId.redemption_in_liba.amount,
      liba_rows: byId.liba_commission.rows,
      insurance_rows: byId.insurance_sales.rows,
      redemption_rows: byId.redemption_in_liba.rows,
      note: [sourceRef.trim() ? `אסמכתא: ${sourceRef.trim()}` : "", `נשמר על ידי ${actor}. סכום ריק נשאר ריק.`]
        .filter(Boolean)
        .join(" · "),
    });
    if (error) return { error: isMissingRelation(error.message) ? "טבלת הטיוטות עדיין לא הורצה" : error.message };
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "השמירה נכשלה" };
  }
}

export async function advanceSettlementDraft(id: string, next: string): Promise<{ error: string | null }> {
  if (!ORDER.includes(next as SettlementStatus)) return { error: "סטטוס לא מוכר" };
  try {
    const admin = shemeshAdmin();
    const current = await admin.from("shemesh_settlement_drafts").select("status").eq("id", id).maybeSingle();
    if (current.error) return { error: isMissingRelation(current.error.message) ? "טבלת הטיוטות עדיין לא הורצה" : current.error.message };
    const status = String(current.data?.status ?? "");
    if (!settlementMoveAllowed(status, next)) return { error: "אפשר רק שלב אחד קדימה: טיוטה, אושר, שולם" };
    const { error } = await admin.from("shemesh_settlement_drafts").update({
      status: next,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "העדכון נכשל" };
  }
}

function assertSettlementMoves(): void {
  if (!settlementMoveAllowed("draft", "approved")) throw new Error("draft must move to approved");
  if (!settlementMoveAllowed("approved", "paid")) throw new Error("approved must move to paid");
  if (settlementMoveAllowed("draft", "paid")) throw new Error("settlement jump must stay blocked");
  if (settlementMoveAllowed("paid", "draft")) throw new Error("paid must not move backward");
}

assertSettlementMoves();
