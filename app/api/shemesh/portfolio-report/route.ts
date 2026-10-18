import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import type { PolicyDocument } from "@/lib/shemesh/portfolio-from-documents";
import { buildPortfolioWithModel } from "@/lib/shemesh/portfolio-from-model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401, headers: NO_STORE });
  }

  const form = await request.formData();
  const brief = String(form.get("brief") ?? "");
  const manager = String(form.get("manager") ?? "").trim() || "שי בר-און";
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length || !brief.trim()) {
    return NextResponse.json({ error: "צריך להעלות את הפוליסות ולהדביק את ההצעה." }, { status: 400, headers: NO_STORE });
  }

  const dir = await mkdtemp(path.join(tmpdir(), "shemesh-policies-"));
  try {
    const paths: string[] = [];
    for (const [index, file] of files.entries()) {
      const safe = path.basename(file.name).replace(/[^\w.\u0590-\u05FF ()-]/g, "_") || "policy.pdf";
      const target = path.join(dir, `${index}-${safe}`);
      await writeFile(target, Buffer.from(await file.arrayBuffer()));
      paths.push(target);
    }
    const documents = await extractPolicyText(paths);
    const model = await buildPortfolioWithModel(documents, brief, manager);
    if ("error" in model) {
      return NextResponse.json({ error: model.error }, { status: 502, headers: NO_STORE });
    }
    return NextResponse.json(model.report, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : "הקריאה מהפוליסות נכשלה";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function extractPolicyText(paths: string[]): Promise<PolicyDocument[]> {
  const script = path.join(process.cwd(), "scripts", "extract-policy-text.py");
  return new Promise((resolve, reject) => {
    const child = spawn("python", [script, ...paths], {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", () => reject(new Error("פייתון לא זמין לקריאת הפוליסות")));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(err).toString("utf8").trim() || "לא הצלחתי לקרוא את קובצי הפוליסה"));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(out).toString("utf8")) as PolicyDocument[]);
      } catch {
        reject(new Error("הטקסט שנקרא מהפוליסות לא חזר תקין"));
      }
    });
  });
}
