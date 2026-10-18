import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_PATH =
  "C:\\Users\\Beo-syestems\\Liba\\OneDrive - liba cnt\\שמש מימוש זכויות\\תפעול שמש\\דוח מכירות שמש פדיונות 2 .xlsx";

function loadEnvFile(fileName) {
  const full = resolve(process.cwd(), fileName);
  if (!existsSync(full)) return;
  const text = readFileSync(full, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const filePath = process.env.SHEMESH_EXCEL_LOCAL_PATH?.trim() || DEFAULT_PATH;
const baseUrl = (
  process.env.SHEMESH_DASHBOARD_URL ||
  process.env.SALES_DASHBOARD_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://liba.os.beosystem.com"
).replace(/\/+$/, "");
const token =
  process.env.SALES_EXCEL_UPLOAD_TOKEN?.trim() ||
  process.env.SALES_TV_KIOSK_TOKEN?.trim();

if (!token) {
  console.error(
    "חסר טוקן. הוסיפו SALES_TV_KIOSK_TOKEN או SALES_EXCEL_UPLOAD_TOKEN ל-.env.local",
  );
  process.exit(1);
}

if (!existsSync(filePath)) {
  console.error("הקובץ לא נמצא:\n" + filePath);
  process.exit(1);
}

let lastStamp = "";

async function pushIfChanged() {
  const st = statSync(filePath);
  const stamp = `${st.mtimeMs}:${st.size}`;
  if (stamp === lastStamp) return;
  lastStamp = stamp;

  const bytes = readFileSync(filePath);
  const blob = new Blob([bytes]);
  const form = new FormData();
  form.append("file", blob, filePath.split(/[/\\]/).pop() || "shemesh-sales.xlsx");

  const res = await fetch(`${baseUrl}/api/shemesh/sales-excel/ingest`, {
    method: "POST",
    headers: { "x-sales-excel-token": token },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(new Date().toLocaleTimeString("he-IL"), res.status, text);
    lastStamp = "";
    return;
  }
  console.log(new Date().toLocaleTimeString("he-IL"), "עודכן דוח שמש", text);
}

console.log("מעקב אחרי דוח המכירות של שמש כל 5 שניות:");
console.log(filePath);
console.log("יעד:", baseUrl);

await pushIfChanged();
if (process.argv.includes("--once")) process.exit(0);
setInterval(() => {
  void pushIfChanged().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    lastStamp = "";
  });
}, 5_000);
