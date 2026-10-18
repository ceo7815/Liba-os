"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FileText, Plus, Printer, Trash2, Upload } from "lucide-react";
import { PortfolioReportDocument } from "@/components/shemesh/portfolio-report-document";
import { Button } from "@/components/ui/button";
import {
  emptyBlock,
  emptyReport,
  reportId,
  tantFamilyReport,
  type PortfolioReport,
  type ReportBlock,
  type ReportSide,
} from "@/lib/shemesh/portfolio-report";

const STORAGE_KEY = "shemesh.portfolio-report.v2";

const field =
  "w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring";

export function PortfolioReportScreen() {
  const [report, setReport] = useState<PortfolioReport>(emptyReport);
  const [ready, setReady] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [documentsOpen, setDocumentsOpen] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PortfolioReport;
        if (parsed.familyName) {
          setReport(parsed);
          setDocumentsOpen(false);
          setManualOpen(false);
        }
      } catch {
        setReport(emptyReport());
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!report.familyName) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
  }, [ready, report]);

  async function buildFromDocuments() {
    setBusy(true);
    setStatus("");
    const body = new FormData();
    for (const file of files) body.append("files", file);
    body.append("brief", brief);
    body.append("manager", report.manager || "שי בר-און");
    try {
      const response = await fetch("/api/shemesh/portfolio-report", { method: "POST", body });
      const payload = (await response.json()) as PortfolioReport & { error?: string; skipped?: string[] };
      if (!response.ok) {
        setStatus(payload.error || "הבנייה נכשלה");
        return;
      }
      const { skipped, ...next } = payload;
      setReport(next);
      setDocumentsOpen(false);
      setManualOpen(false);
      setStatus(skipped?.length ? `הדוח מוכן. דולגו קבצים שאינם פוליסה: ${skipped.join(", ")}` : "הדוח מוכן.");
    } catch {
      setStatus("הבנייה נכשלה. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  function patch(partial: Partial<PortfolioReport>) {
    setReport((current) => ({ ...current, ...partial }));
  }

  function patchBlock(id: string, partial: Partial<ReportBlock>) {
    setReport((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.id === id ? { ...block, ...partial } : block)),
    }));
  }

  function patchSide(id: string, key: "existing" | "proposed", partial: Partial<ReportSide>) {
    setReport((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === id ? { ...block, [key]: { ...block[key], ...partial } } : block,
      ),
    }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-print shrink-0 space-y-4 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">שמש</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <FileText className="size-5" />
              השוואת תיק
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              מעלים את דפי הפוליסה ומדביקים את ההצעה. המערכת קוראת את המצב הקיים ואת המצב החדש, ובונה את דוח ההשוואה.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => { setReport(tantFamilyReport()); setDocumentsOpen(false); setManualOpen(false); }}>
              דוגמה: משפחת טאנט
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReport(emptyReport());
                setStatus("");
                setDocumentsOpen(true);
                setManualOpen(false);
              }}
            >
              דוח חדש
            </Button>
            <Button type="button" onClick={() => window.print()} disabled={!report.familyName}>
              <Printer className="size-4" />
              הפקת דוח
            </Button>
          </div>
        </div>

        <details
          open={documentsOpen}
          onToggle={(event) => setDocumentsOpen(event.currentTarget.open)}
          className="app-surface px-4 py-3"
        >
          <summary className="cursor-pointer text-sm font-medium">מסמכים וכתיבה חופשית</summary>
          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-[#f4f7fb] px-4 py-6 text-sm">
              <Upload className="size-5" />
              <span className="font-medium">דפי פרטי ביטוח, PDF</span>
              <span className="text-xs text-muted-foreground">אפשר כמה קבצים יחד. דוח השוואה שכבר הופק ידולג.</span>
              <input
                className="sr-only"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={(event) => setFiles([...(event.target.files ?? [])])}
              />
            </label>
            {files.length > 0 ? (
              <ul className="text-xs text-muted-foreground">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`}>{file.name}</li>
                ))}
              </ul>
            ) : null}
            <Field label="כתיבה חופשית — ההצעה כמו שהיא נכתבת">
              <textarea
                className={`${field} min-h-40`}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder={"החלטות לביצוע: שם המבוטח\nביטוח בריאות\nעלות חודשית: 0"}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={buildFromDocuments} disabled={busy || files.length === 0 || !brief.trim()}>
                {busy ? "קורא את הפוליסות…" : "בניית הדוח"}
              </Button>
              {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
            </div>
          </div>
        </details>

        <details
          open={manualOpen}
          onToggle={(event) => setManualOpen(event.currentTarget.open)}
          className="app-surface px-4 py-3"
        >
          <summary className="cursor-pointer text-sm font-medium">תיקון ידני</summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="משפחה">
                <input className={field} value={report.familyName} onChange={(event) => patch({ familyName: event.target.value })} placeholder="משפחת טאנט" />
              </Field>
              <Field label="מנהל תיק לקוח">
                <input className={field} value={report.manager} onChange={(event) => patch({ manager: event.target.value })} />
              </Field>
              <Field label="תאריך">
                <input className={field} type="date" value={report.updatedOn} onChange={(event) => patch({ updatedOn: event.target.value })} />
              </Field>
              <Field label="טלפון בסוף הדוח">
                <input className={field} value={report.phone} onChange={(event) => patch({ phone: event.target.value })} />
              </Field>
              <Field label="תיאור מצב קיים">
                <input className={field} value={report.existingCaption} onChange={(event) => patch({ existingCaption: event.target.value })} placeholder="6 פוליסות ב־3 חברות" />
              </Field>
              <Field label="תיאור מצב חדש">
                <input className={field} value={report.proposedCaption} onChange={(event) => patch({ proposedCaption: event.target.value })} placeholder="3 הצעות חדשות" />
              </Field>
            </div>

            {report.blocks.map((block, index) => (
              <section key={block.id} className="rounded-2xl bg-[#f4f7fb] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">תחום {index + 1}</h2>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => patch({ blocks: report.blocks.filter((item) => item.id !== block.id) })}
                  >
                    <Trash2 className="size-3.5" />
                    הסרה
                  </button>
                </div>
                <Field label="כותרת התחום">
                  <input className={field} value={block.title} onChange={(event) => patchBlock(block.id, { title: event.target.value })} placeholder="ביטוח חיים — שם המבוטח" />
                </Field>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <SideForm title="מצב קיים" side={block.existing} onChange={(partial) => patchSide(block.id, "existing", partial)} />
                  <SideForm title="מצב חדש" side={block.proposed} onChange={(partial) => patchSide(block.id, "proposed", partial)} />
                </div>
              </section>
            ))}

            <Button type="button" variant="outline" onClick={() => patch({ blocks: [...report.blocks, emptyBlock()] })}>
              <Plus className="size-4" />
              תחום נוסף
            </Button>

            <div className="grid gap-3 lg:grid-cols-2">
              <Field label="מה מקבלים לצד החיסכון — שורה לכל נקודה">
                <textarea className={`${field} min-h-28`} value={report.gains} onChange={(event) => patch({ gains: event.target.value })} />
              </Field>
              <Field label="לבדיקה לפני מעבר — שורה לכל נקודה">
                <textarea className={`${field} min-h-28`} value={report.checks} onChange={(event) => patch({ checks: event.target.value })} />
              </Field>
            </div>
          </div>
        </details>
      </div>

      {report.familyName ? <ReportPreview report={report} /> : null}
    </div>
  );
}

function ReportPreview({ report }: { report: PortfolioReport }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, width: 0, height: 0 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const sheet = sheetRef.current;
    if (!frame || !sheet) return;

    const update = () => {
      const naturalWidth = sheet.offsetWidth || 1;
      const naturalHeight = sheet.scrollHeight || 1;
      const available = Math.max(frame.clientWidth - 72, 280);
      const scale = available / naturalWidth;
      const width = naturalWidth * scale;
      const height = naturalHeight * scale;
      setBox((current) => {
        if (Math.abs(current.scale - scale) < 0.01 && Math.abs(current.height - height) < 2) return current;
        return { scale, width, height };
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [report]);

  return (
    <div
      ref={frameRef}
      dir="ltr"
      className="report-preview -mx-3 mt-4 min-h-0 flex-1 overflow-auto bg-[#d5d5d2] px-6 py-8 sm:-mx-6 print:m-0 print:overflow-visible print:bg-white print:p-0"
    >
      <div
        className="report-stage relative mx-auto"
        style={box.height ? { width: box.width, height: box.height } : undefined}
      >
        <div
          ref={sheetRef}
          className="report-sheet absolute left-0 top-0 w-[210mm] bg-white px-[10mm] py-[8mm] shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
          style={{ transform: `scale(${box.scale})`, transformOrigin: "top left" }}
        >
          <PortfolioReportDocument report={report} />
        </div>
      </div>
    </div>
  );
}

function SideForm({
  title,
  side,
  onChange,
}: {
  title: string;
  side: ReportSide;
  onChange: (partial: Partial<ReportSide>) => void;
}) {
  return (
    <div className="rounded-2xl bg-[#f4f7fb] p-3">
      <p className="mb-2 text-xs font-semibold">{title}</p>
      <div className="space-y-2">
        <input className={field} value={side.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="חברה · מספר פוליסה" />
        <textarea className={`${field} min-h-16`} value={side.note} onChange={(event) => onChange({ note: event.target.value })} placeholder="החלטה לביצוע, שורה לכל פסקה" />
        <textarea className={`${field} min-h-24`} value={side.lines} onChange={(event) => onChange({ lines: event.target.value })} placeholder="כיסויים, מבוטחים, החרגות. שורה לכל נקודה" />
        {side.costs.map((cost) => (
          <div key={cost.id} className="flex gap-2">
            <input className={field} value={cost.label} onChange={(event) => onChange({ costs: side.costs.map((item) => item.id === cost.id ? { ...item, label: event.target.value } : item) })} placeholder="שם העלות" />
            <input className={`${field} w-28 shrink-0`} value={cost.amount} onChange={(event) => onChange({ costs: side.costs.map((item) => item.id === cost.id ? { ...item, amount: event.target.value } : item) })} placeholder="סכום" />
            <button type="button" className="text-muted-foreground" onClick={() => onChange({ costs: side.costs.filter((item) => item.id !== cost.id) })} aria-label="הסרת עלות">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => onChange({ costs: [...side.costs, { id: reportId(), label: "", amount: "" }] })}
        >
          שורת עלות
        </button>
        <input className={field} value={side.total} onChange={(event) => onChange({ total: event.target.value })} placeholder="עלות חודשית לסיכום" />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
