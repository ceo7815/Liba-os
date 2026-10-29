import * as XLSX from "xlsx";
import { asRows, isMissingRelation, shemeshAdmin } from "@/lib/shemesh/db";
import { formatIls } from "@/lib/format/numbers";

export function spendForecast(spend: number, daysElapsed: number, daysInMonth: number): number | null {
  if (spend <= 0 || daysElapsed <= 0 || daysInMonth <= 0) return null;
  const left = Math.max(0, daysInMonth - daysElapsed);
  return Math.round((spend / daysElapsed) * left * 100) / 100;
}

export type BankLine = { day: string; description: string; amount: number };
export type ExpectedFee = { id: string; client: string; fee: number };

/** One bank amount matches one expected fee. Unverified fees are not targets. */
export function matchBankToFees(lines: BankLine[], fees: ExpectedFee[]): { index: number; ledgerId: string | null }[] {
  const used = new Set<string>();
  return lines.map((line, index) => {
    const hit = fees.find((fee) => !used.has(fee.id) && Math.abs(fee.fee - Math.abs(line.amount)) < 0.01);
    if (!hit) return { index, ledgerId: null };
    used.add(hit.id);
    return { index, ledgerId: hit.id };
  });
}

export function parseBankGrid(rows: string[][]): BankLine[] {
  const body = rows.filter((row) => row.some((cell) => cell.trim()));
  const start = body[0]?.some((cell) => /תאריך|date|סכום|amount/i.test(cell)) ? 1 : 0;
  const lines: BankLine[] = [];
  for (const row of body.slice(start)) {
    const day = (row[0] ?? "").slice(0, 10);
    const description = row[1] ?? "";
    const amount = Number(String(row[2] ?? "").replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(amount)) continue;
    lines.push({ day: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "", description, amount });
  }
  return lines;
}

export function parseBankBuffer(name: string, buffer: Buffer): BankLine[] {
  if (name.toLowerCase().endsWith(".csv")) return parseBankGrid(parseCsv(buffer.toString("utf8")));
  const book = XLSX.read(buffer, { type: "buffer" });
  const sheet = book.Sheets[book.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: false }) as string[][];
  return parseBankGrid(grid.map((row) => row.map((cell) => String(cell ?? ""))));
}

function parseCsv(text: string): string[][] {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split(",").map((cell) => cell.trim()));
}

export function budgetRemainder(budget: number | null, spent: number | null, forecast: number | null): number | null {
  if (budget == null || spent == null || forecast == null) return null;
  return Math.round((budget - spent - forecast) * 100) / 100;
}

export function accountantDraftText(input: {
  month: string;
  collectedNet: number | null;
  ratesPending: boolean;
  settlementStatus: string | null;
}): { subject: string; body: string } {
  const fee = input.ratesPending ? "שכר הטרחה ממתין לאימות השיעור" : `שכר טרחה בספר ${formatIls(input.collectedNet)}`;
  return {
    subject: `טיוטה לרואה החשבון · שמש · ${input.month}`,
    body: [
      "זו טיוטה בלבד. המערכת לא שולחת אותה.",
      fee + ".",
      input.settlementStatus ? `התחשבנות: ${input.settlementStatus}.` : "אין טיוטת התחשבנות שמורה.",
      "גבייה בחשבון ליבה לא נכללת בלי ייבוא בנק.",
    ].join("\n"),
  };
}

export async function loadExpectedFees(): Promise<ExpectedFee[]> {
  const admin = shemeshAdmin();
  const { data, error } = await admin.from("shemesh_ledger").select("id, client_name, fee, status").limit(400);
  if (error) return [];
  return asRows(data)
    .filter((row) => (row.status === "open" || row.status === "waiting") && row.fee != null)
    .map((row) => ({ id: String(row.id), client: String(row.client_name ?? ""), fee: Number(row.fee) }));
}

export async function importBankLines(name: string, buffer: Buffer, actor: string): Promise<{ error: string | null; matched: number; open: number }> {
  const lines = parseBankBuffer(name, buffer);
  if (!lines.length) return { error: "אין שורות סכום בקובץ", matched: 0, open: 0 };
  const fees = await loadExpectedFees();
  const matches = matchBankToFees(lines, fees);
  const admin = shemeshAdmin();
  let matched = 0;
  for (const [index, line] of lines.entries()) {
    const hit = matches.find((item) => item.index === index);
    if (hit?.ledgerId) matched += 1;
    const { error } = await admin.from("shemesh_bank_lines").insert({
      day: line.day || null,
      description: line.description.slice(0, 200),
      amount: line.amount,
      matched_ledger_id: hit?.ledgerId ?? null,
      import_name: name.slice(0, 120),
    });
    if (error) return { error: isMissingRelation(error.message) ? "טבלת הבנק עדיין לא הורצה" : error.message, matched, open: lines.length - matched };
  }
  const { writeAudit } = await import("@/lib/shemesh/ops");
  await writeAudit(actor, "import", "bank", name, `ייבוא בנק ${matched} הותאמו מתוך ${lines.length}`);
  return { error: null, matched, open: lines.length - matched };
}

export async function loadBankLines(): Promise<{ missing: boolean; rows: { id: string; day: string; description: string; amount: number; matched: boolean }[] }> {
  try {
    const { data, error } = await shemeshAdmin().from("shemesh_bank_lines").select("*").order("created_at", { ascending: false }).limit(80);
    if (error) return { missing: isMissingRelation(error.message), rows: [] };
    return {
      missing: false,
      rows: asRows(data).map((row) => ({
        id: String(row.id),
        day: String(row.day ?? ""),
        description: String(row.description ?? ""),
        amount: Number(row.amount),
        matched: Boolean(row.matched_ledger_id),
      })),
    };
  } catch (error) {
    return { missing: isMissingRelation(error instanceof Error ? error.message : ""), rows: [] };
  }
}

export async function saveAdReceipt(input: { month: string; campaign: string; source: string; fileName: string; byteSize: number }, actor: string): Promise<{ error: string | null }> {
  const source = input.source === "google" || input.source === "facebook" ? input.source : "other";
  const { error } = await shemeshAdmin().from("shemesh_ad_receipts").insert({
    month: input.month,
    campaign: input.campaign.slice(0, 160),
    source,
    file_name: input.fileName.slice(0, 180),
    byte_size: input.byteSize,
  });
  if (error) return { error: isMissingRelation(error.message) ? "טבלת הקבלות עדיין לא הורצה" : error.message };
  const { writeAudit } = await import("@/lib/shemesh/ops");
  await writeAudit(actor, "archive", "ad_receipt", input.fileName, `קבלה ${input.month} · ${input.campaign || "בלי קמפיין"}`);
  return { error: null };
}

export async function loadAdReceipts(): Promise<{ missing: boolean; rows: { id: string; month: string; campaign: string; source: string; fileName: string }[] }> {
  try {
    const { data, error } = await shemeshAdmin().from("shemesh_ad_receipts").select("*").order("created_at", { ascending: false }).limit(40);
    if (error) return { missing: isMissingRelation(error.message), rows: [] };
    return {
      missing: false,
      rows: asRows(data).map((row) => ({
        id: String(row.id),
        month: String(row.month ?? ""),
        campaign: String(row.campaign ?? ""),
        source: String(row.source ?? ""),
        fileName: String(row.file_name ?? ""),
      })),
    };
  } catch (error) {
    return { missing: isMissingRelation(error instanceof Error ? error.message : ""), rows: [] };
  }
}

export async function saveMailDraft(input: { month: string; recipient: string; subject: string; body: string }, actor: string): Promise<{ error: string | null }> {
  const { error } = await shemeshAdmin().from("shemesh_mail_drafts").insert({
    month: input.month,
    recipient: input.recipient.slice(0, 160),
    subject: input.subject.slice(0, 200),
    body: input.body.slice(0, 4000),
  });
  if (error) return { error: isMissingRelation(error.message) ? "טבלת הטיוטות עדיין לא הורצה" : error.message };
  const { writeAudit } = await import("@/lib/shemesh/ops");
  await writeAudit(actor, "draft", "mail", input.month, "נשמרה טיוטת מייל. לא נשלח.");
  return { error: null };
}

export async function loadMailDrafts(): Promise<{ missing: boolean; rows: { id: string; month: string; recipient: string; subject: string; body: string }[] }> {
  try {
    const { data, error } = await shemeshAdmin().from("shemesh_mail_drafts").select("*").order("created_at", { ascending: false }).limit(12);
    if (error) return { missing: isMissingRelation(error.message), rows: [] };
    return {
      missing: false,
      rows: asRows(data).map((row) => ({
        id: String(row.id),
        month: String(row.month ?? ""),
        recipient: String(row.recipient ?? ""),
        subject: String(row.subject ?? ""),
        body: String(row.body ?? ""),
      })),
    };
  } catch (error) {
    return { missing: isMissingRelation(error instanceof Error ? error.message : ""), rows: [] };
  }
}

export async function saveAdBudget(month: string, amount: number, actor: string): Promise<{ error: string | null }> {
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(amount) || amount < 0) return { error: "חודש או סכום לא תקינים" };
  const { error } = await shemeshAdmin().from("shemesh_ad_budgets").upsert({ month, amount, updated_at: new Date().toISOString() });
  if (error) return { error: isMissingRelation(error.message) ? "טבלת התקציב עדיין לא הורצה" : error.message };
  const { writeAudit } = await import("@/lib/shemesh/ops");
  await writeAudit(actor, "save", "ad_budget", month, `תקציב פרסום ${month}`);
  return { error: null };
}

export async function loadAdBudget(month: string): Promise<{ missing: boolean; amount: number | null }> {
  try {
    const { data, error } = await shemeshAdmin().from("shemesh_ad_budgets").select("amount").eq("month", month).maybeSingle();
    if (error) return { missing: isMissingRelation(error.message), amount: null };
    const amount = data && typeof data === "object" && "amount" in data ? Number((data as { amount: unknown }).amount) : null;
    return { missing: false, amount: amount != null && Number.isFinite(amount) ? amount : null };
  } catch (error) {
    return { missing: isMissingRelation(error instanceof Error ? error.message : ""), amount: null };
  }
}

function assertClosing(): void {
  const fees = [{ id: "a", client: "מ", fee: 400 }, { id: "b", client: "א", fee: 1500 }];
  const lines = [{ day: "2026-10-18", description: "העברה", amount: -400 }, { day: "", description: "אחר", amount: 10 }];
  const matched = matchBankToFees(lines, fees);
  if (matched[0]?.ledgerId !== "a" || matched[1]?.ledgerId != null) throw new Error("bank match must use the saved fee once");
  if (budgetRemainder(1000, 300, 200) !== 500) throw new Error("budget remainder drifted");
  if (budgetRemainder(null, 1, 1) != null) throw new Error("missing budget stays empty");
  const draft = accountantDraftText({ month: "2026-10", collectedNet: 100, ratesPending: true, settlementStatus: null });
  if (draft.body.includes("נשלח") || !draft.body.includes("לא שולחת")) throw new Error("accountant text must stay a draft");
}

assertClosing();
