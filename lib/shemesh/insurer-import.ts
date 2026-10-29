import * as XLSX from "xlsx";

export const INSURERS = [
  { id: "harel", label: "הראל" },
  { id: "migdal", label: "מגדל" },
  { id: "clal", label: "כלל" },
  { id: "menora", label: "מנורה" },
  { id: "phoenix", label: "הפניקס" },
  { id: "ayalon", label: "איילון" },
  { id: "altshuler", label: "אלטשולר שחם" },
  { id: "meitav", label: "מיטב" },
  { id: "more", label: "מור" },
] as const;

export type InsurerId = (typeof INSURERS)[number]["id"];

export const IMPORT_FIELDS = [
  { id: "policy", label: "פוליסה" },
  { id: "client", label: "לקוח" },
  { id: "premium", label: "פרמיה" },
  { id: "commission", label: "עמלה" },
  { id: "date", label: "תאריך" },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["id"];
export type ColumnMapping = Partial<Record<ImportField, string>>;
export type ImportTable = { headers: string[]; rows: Record<string, string>[] };

export function insurerExternalKey(company: string, row: { policy: string; date: string; premium: string; commission: string }): string {
  return [company, row.policy, row.date, row.premium, row.commission].join("|").replace(/\s+/g, "");
}

export function parseInsurerFile(fileName: string, bytes: Uint8Array): ImportTable & { kind: "excel" | "swiftness" } {
  const name = fileName.toLowerCase();
  const head = Buffer.from(bytes.subarray(0, 80)).toString("utf8").trim();
  if (name.endsWith(".xml") || head.startsWith("<")) {
    return { kind: "swiftness", ...parseSwiftnessXml(Buffer.from(bytes).toString("utf8")) };
  }
  const book = XLSX.read(bytes, { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: false, defval: "" });
  const headers = (matrix[0] ?? []).map((cell) => String(cell).trim()).filter(Boolean);
  const rows = matrix.slice(1).filter((line) => line.some((cell) => String(cell).trim())).map((line) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = String(line[index] ?? "").trim();
    });
    return row;
  });
  return { kind: "excel", headers, rows };
}

export function parseSwiftnessXml(xml: string): ImportTable {
  const blocks = xml.split(/<[^/!?][^>]*>/).length > 2 ? extractXmlRows(xml) : [];
  const headers = Array.from(new Set(blocks.flatMap((row) => Object.keys(row))));
  return { headers, rows: blocks };
}

function extractXmlRows(xml: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const chunks = xml.split(/<\/(?:Row|row|Record|record|Policy|policy)>/i);
  for (const chunk of chunks) {
    const row: Record<string, string> = {};
    const tags = chunk.matchAll(/<([A-Za-z0-9_\u0590-\u05FF]+)[^>]*>([^<]*)/g);
    for (const tag of tags) {
      const value = tag[2].trim();
      if (value) row[tag[1]] = value;
    }
    if (Object.keys(row).length) rows.push(row);
  }
  return rows;
}

export function applyMapping(table: ImportTable, mapping: ColumnMapping): {
  rows: { policy: string; client: string; premium: string; commission: string; date: string; key: string }[];
  errors: string[];
} {
  const errors: string[] = [];
  if (!mapping.policy) errors.push("חסרה עמודת פוליסה");
  const rows = table.rows.map((raw) => ({
    policy: mapping.policy ? raw[mapping.policy] ?? "" : "",
    client: mapping.client ? raw[mapping.client] ?? "" : "",
    premium: mapping.premium ? raw[mapping.premium] ?? "" : "",
    commission: mapping.commission ? raw[mapping.commission] ?? "" : "",
    date: mapping.date ? raw[mapping.date] ?? "" : "",
    key: "",
  }));
  rows.forEach((row, index) => {
    if (!row.policy) errors.push(`שורה ${index + 1}: אין מספר פוליסה`);
    if (row.premium && !Number.isFinite(Number(row.premium.replace(/,/g, "")))) errors.push(`שורה ${index + 1}: פרמיה לא מספר`);
    if (row.commission && !Number.isFinite(Number(row.commission.replace(/,/g, "")))) errors.push(`שורה ${index + 1}: עמלה לא מספר`);
    row.key = insurerExternalKey("pending", row);
  });
  return { rows, errors: errors.slice(0, 30) };
}

export function assertInsurerImportIsIdempotent(): void {
  const key = insurerExternalKey("migdal", { policy: "123", date: "2026-10-01", premium: "100", commission: "12" });
  if (key !== insurerExternalKey("migdal", { policy: "123", date: "2026-10-01", premium: "100", commission: "12" })) {
    throw new Error("the same insurer row must keep the same key");
  }
  if (insurerExternalKey("harel", { policy: "123", date: "2026-10-01", premium: "100", commission: "12" }) === key) {
    throw new Error("a different company must not share the key");
  }
  const parsed = parseSwiftnessXml("<Policy><PolicyNumber>9</PolicyNumber><Premium>10</Premium></Policy>");
  if (!parsed.headers.includes("PolicyNumber") || parsed.rows[0]?.PolicyNumber !== "9") {
    throw new Error("swiftness xml did not yield a row");
  }
}

assertInsurerImportIsIdempotent();
