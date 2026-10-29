"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { MenuField } from "@/components/admin/menu-field";
import { importLeads, type ImportResult } from "@/lib/crm/actions";

const targets = [
  "name",
  "phone",
  "email",
  "title",
  "value",
  "temperature",
  "tags",
  "note",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "ctwa_id",
] as const;
type Target = (typeof targets)[number];

const guesses: Record<Target, string[]> = {
  name: ["name", "full name", "fullname", "full_name", "contact", "שם", "שם מלא", "איש קשר", "לקוח"],
  phone: ["phone", "mobile", "phone number", "whatsapp", "טלפון", "נייד", "מספר טלפון"],
  email: ["email", "e-mail", "mail", "מייל", "אימייל", "דוא\"ל"],
  title: ["title", "subject", "product", "interest", "כותרת", "נושא", "מוצר"],
  value: ["value", "amount", "budget", "deal value", "שווי", "ערך", "סכום"],
  temperature: ["temperature", "טמפרטורה"],
  tags: ["tags", "tag", "labels", "תגיות", "תגית"],
  note: ["note", "notes", "comment", "comments", "הערה", "הערות"],
  utm_source: ["utm_source"],
  utm_medium: ["utm_medium"],
  utm_campaign: ["utm_campaign", "campaign", "קמפיין"],
  utm_content: ["utm_content"],
  utm_term: ["utm_term"],
  fbclid: ["fbclid"],
  gclid: ["gclid"],
  ctwa_id: ["ctwa_id", "ctwaid", "ctwa_clid"],
};

const skip = "__skip";
const chunk = 500;

function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function guess(headers: string[]): Record<Target, number> {
  const normal = headers.map((header) => header.trim().toLowerCase());
  return Object.fromEntries(
    targets.map((target) => [target, normal.findIndex((header) => guesses[target].includes(header))]),
  ) as Record<Target, number>;
}

const reasons: Record<string, string> = {
  "name is required": "name",
  "contact is required": "contact",
  "email is not allowed": "email",
  "phone is not allowed": "phone",
  "value is not allowed": "value",
};

export function LeadImport() {
  const t = useTranslations("crm.import");
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [body, setBody] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<Target, number> | null>(null);
  const [rotation, setRotation] = useState("rotation");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [problem, setProblem] = useState("");
  const [pending, start] = useTransition();

  async function read(file: File) {
    setResult(null);
    setProblem("");
    if (file.size > 5 * 1024 * 1024) {
      setProblem(t("tooBig"));
      return;
    }
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setProblem(t("empty"));
      return;
    }
    if (rows.length - 1 > 2000) {
      setProblem(t("tooMany"));
      return;
    }
    setFileName(file.name);
    setHeaders(rows[0]);
    setBody(rows.slice(1));
    setMap(guess(rows[0]));
  }

  const records = map
    ? body.map((row) =>
        Object.fromEntries(
          targets.flatMap((target) => (map[target] >= 0 ? [[target, (row[map[target]] ?? "").trim().slice(0, 2000)]] : [])),
        ),
      )
    : [];
  const ready = map !== null && map.name >= 0 && (map.phone >= 0 || map.email >= 0);

  function run() {
    if (!ready) return;
    setResult(null);
    setProgress(0);
    start(async () => {
      const total: ImportResult = { ok: true, created: 0, errors: [] };
      for (let offset = 0; offset < records.length; offset += chunk) {
        const part = await importLeads(records.slice(offset, offset + chunk), rotation === "rotation", offset).catch(() => null);
        if (!part || !part.ok) {
          total.ok = false;
          break;
        }
        total.created += part.created;
        total.errors.push(...part.errors);
        setProgress(Math.min(records.length, offset + chunk));
      }
      setResult(total);
      router.refresh();
    });
  }

  const columnOptions = [{ value: skip, label: t("skip") }, ...headers.map((header, index) => ({ value: String(index), label: header || `#${index + 1}` }))];

  return (
    <div className="grid gap-4">
      <label className="grid w-fit gap-1 text-sm">
        <span className="text-muted-foreground">{t("file")}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void read(file);
          }}
          className="text-sm file:me-3 file:h-10 file:rounded-full file:border file:border-border file:bg-card file:px-4 file:text-sm"
        />
        <span className="text-xs text-muted-foreground">{t("fileHint")}</span>
      </label>
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}

      {map ? (
        <>
          <p className="text-sm">{t("found", { count: body.length, file: fileName })}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {targets.map((target) => (
              <MenuField
                key={target}
                label={t(`targets.${target}`)}
                value={map[target] >= 0 ? String(map[target]) : skip}
                onChange={(value) => setMap({ ...map, [target]: value === skip ? -1 : Number(value) })}
                options={columnOptions}
              />
            ))}
          </div>
          {!ready ? <p className="text-sm text-destructive">{t("needs")}</p> : null}

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-xs">
              <caption className="px-3 py-2 text-start text-muted-foreground">{t("preview")}</caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  {targets
                    .filter((target) => map[target] >= 0)
                    .map((target) => (
                      <th key={target} className="px-3 py-2 text-start font-medium">
                        {t(`targets.${target}`)}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 5).map((record, index) => (
                  <tr key={index} className="border-b border-border last:border-b-0">
                    {targets
                      .filter((target) => map[target] >= 0)
                      .map((target) => (
                        <td key={target} className="max-w-48 truncate px-3 py-2">
                          <bdi>{record[target]}</bdi>
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <MenuField
                label={t("owner")}
                value={rotation}
                onChange={setRotation}
                options={[
                  { value: "rotation", label: t("rotation") },
                  { value: "me", label: t("me") },
                ]}
              />
            </div>
            <button
              type="button"
              disabled={!ready || pending}
              onClick={run}
              className="press h-10 rounded-full bg-primary px-5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {pending ? t("running", { done: progress, total: records.length }) : t("run", { count: records.length })}
            </button>
          </div>
        </>
      ) : null}

      {result ? (
        <div role="status" className="grid gap-2 rounded-2xl bg-muted px-4 py-3 text-sm">
          <p className="font-medium">{result.ok ? t("done", { count: result.created }) : t("failed", { count: result.created })}</p>
          {result.errors.length > 0 ? (
            <>
              <p className="text-muted-foreground">{t("skipped", { count: result.errors.length })}</p>
              <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground">
                {result.errors.map((item) => (
                  <li key={item.row}>
                    {t("rowError", { row: item.row + 1, reason: t(`reasons.${reasons[item.message] ?? "other"}`) })}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
