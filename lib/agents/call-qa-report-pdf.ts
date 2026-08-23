import {
  CHECKLIST_STATUS_LABELS,
  FINDING_SEVERITY_LABELS,
  SCORE_WEIGHTS,
  getChecklistItemTitle,
  getChecklistSectionTitle,
  mergeCallIdentification,
  parseCallQaFindings,
  resolveRubricScores,
  type ChecklistStatus,
} from "@/lib/agents/call-qa-checklist";

export type CallReportPdfAnalysis = {
  overall_score: number | string | null;
  summary: string | null;
  recommendations: string[] | null;
  rubric_scores: unknown;
  findings: unknown;
};

export type CallReportPdfInput = {
  customerName: string;
  agentName: string;
  title: string;
  callDate: string;
  duration: string;
  source: string;
  status: string;
  fileName?: string;
  driveUrl?: string | null;
  logoUrl?: string;
  analysis: CallReportPdfAnalysis | null;
};

function esc(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreLine(value: number | string | null | undefined, max: number) {
  if (value == null || value === "") return `—/${max}`;
  return `${Number(value)}/${max}`;
}

function boolHe(v: boolean | null | undefined) {
  if (v == null) return null;
  return v ? "כן" : "לא";
}

function row(label: string, value: string | null | undefined) {
  if (value == null || value === "") return "";
  return `<div class="kv"><span class="k">${esc(label)}</span><span class="v">${esc(value)}</span></div>`;
}

function statusBadge(status: ChecklistStatus | string) {
  const label =
    CHECKLIST_STATUS_LABELS[status as ChecklistStatus] ?? String(status);
  const cls =
    status === "done"
      ? "badge badge-ok"
      : status === "partial"
        ? "badge badge-warn"
        : status === "not_done"
          ? "badge badge-bad"
          : "badge";
  return `<span class="${cls}">${esc(label)}</span>`;
}

export function buildCallReportPdfHtml(input: CallReportPdfInput): string {
  const analysis = input.analysis;
  const scores = resolveRubricScores(
    analysis?.rubric_scores,
    analysis?.overall_score,
  );
  const findings = parseCallQaFindings(analysis?.findings);
  const identification = mergeCallIdentification(
    analysis?.rubric_scores,
    findings,
  );
  const checklist = findings?.checklist ?? [];
  const critical = findings?.critical_events ?? [];
  const gaps = findings?.gaps ?? [];
  const doneWell = findings?.done_well ?? [];
  const manager = findings?.manager_summary;
  const recommendations = analysis?.recommendations ?? [];
  const generatedAt = new Date().toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
  });

  const metaGrid = [
    row("שם לקוח", input.customerName || "לא זוהה"),
    row("שם נציג", input.agentName || "לא זוהה"),
    row("כותרת", input.title),
    row("תאריך שיחה", input.callDate),
    row("משך", input.duration),
    row("מקור", input.source),
    row("סטטוס", input.status),
    row("שם קובץ", input.fileName),
  ]
    .filter(Boolean)
    .join("");

  const scoreCards = `
    <div class="scores">
      <div class="score score-main">
        <div class="score-label">ציון כולל</div>
        <div class="score-value">${esc(scoreLine(scores.total, SCORE_WEIGHTS.total))}</div>
      </div>
      <div class="score">
        <div class="score-label">עמידה בתהליך</div>
        <div class="score-value">${esc(scoreLine(scores.compliance, SCORE_WEIGHTS.compliance))}</div>
      </div>
      <div class="score">
        <div class="score-label">מקצועיות</div>
        <div class="score-value">${esc(scoreLine(scores.professionalism, SCORE_WEIGHTS.professionalism))}</div>
      </div>
      <div class="score">
        <div class="score-label">איכות שיחה</div>
        <div class="score-value">${esc(scoreLine(scores.service_quality, SCORE_WEIGHTS.service_quality))}</div>
      </div>
    </div>`;

  let identificationHtml = "";
  if (identification) {
    identificationHtml = `
      <section>
        <h2>זיהוי השיחה</h2>
        <div class="panel">
          ${row("לקוח", identification.customer_name ?? "לא זוהה")}
          ${row("נציג", identification.rep_name ?? "לא זוהה")}
          ${row("סוכנות", identification.agency_name ?? undefined)}
          ${row("חברה", identification.insurer ?? undefined)}
          ${row("סוג שיחה", identification.call_type ?? undefined)}
          ${row("מוצרים", identification.products_discussed?.join(" · "))}
          ${row("הוצעו", identification.products_offered?.join(" · "))}
          ${row("נרכשו", identification.products_purchased?.join(" · "))}
          ${row("מבוטחים", identification.insured_count != null ? String(identification.insured_count) : undefined)}
          ${row("בגירים נוספים", boolHe(identification.extra_adults) ?? undefined)}
          ${row("ילדים", boolHe(identification.children) ?? undefined)}
          ${row("67+", boolHe(identification.age_67_plus) ?? undefined)}
          ${row("משלם ≠ מבוטח", boolHe(identification.payer_differs_from_insured) ?? undefined)}
          ${row("פוליסה דומה", boolHe(identification.similar_policy_exists) ?? undefined)}
          ${row("הר הביטוח", boolHe(identification.har_habituach_entered) ?? undefined)}
          ${row(
            "סטטוס עסקה",
            identification.deal_status ??
              boolHe(identification.deal_completed) ??
              undefined,
          )}
        </div>
      </section>`;
  }

  let summaryHtml = "";
  if (analysis?.summary || manager) {
    summaryHtml = `
      <section>
        <h2>סיכום מנהל</h2>
        ${analysis?.summary ? `<p class="body">${esc(analysis.summary)}</p>` : ""}
        ${
          manager
            ? `<div class="panel">
                ${row("רמת שיחה", manager.call_level ?? undefined)}
                ${row("תקינות", manager.integrity ?? undefined)}
                ${row("סיכון עיקרי", manager.main_risk ?? undefined)}
                ${row("הדרכה", manager.training_topics?.join(" · "))}
              </div>`
            : ""
        }
      </section>`;
  }

  const criticalHtml = `
    <section>
      <h2>אירועים קריטיים</h2>
      ${
        critical.length === 0
          ? `<div class="panel muted">לא זוהו אירועים קריטיים</div>`
          : `<div class="stack">${critical
              .map(
                (ev) => `
              <div class="critical">
                <div class="critical-title">${esc(ev.title)}</div>
                ${ev.detail ? `<div class="small">${esc(ev.detail)}</div>` : ""}
                ${ev.evidence ? `<div class="small">ראיה: ${esc(ev.evidence)}</div>` : ""}
              </div>`,
              )
              .join("")}</div>`
      }
    </section>`;

  const doneWellHtml =
    doneWell.length > 0
      ? `<section>
          <h2>מה בוצע נכון</h2>
          <ul>${doneWell.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
        </section>`
      : "";

  const gapsHtml =
    gaps.length > 0
      ? `<section>
          <h2>מה לא בוצע / חסר</h2>
          <div class="stack">${gaps
            .map(
              (gap) => `
            <div class="panel">
              <div class="v">${esc(gap.what)}</div>
              ${gap.why_important ? `<div class="small">למה חשוב: ${esc(gap.why_important)}</div>` : ""}
              ${gap.should_have ? `<div class="small">מה היה צריך: ${esc(gap.should_have)}</div>` : ""}
            </div>`,
            )
            .join("")}</div>
        </section>`
      : "";

  const recommendationsHtml =
    recommendations.length > 0
      ? `<section>
          <h2>המלצות לשיפור</h2>
          <ol>${recommendations
            .slice(0, 5)
            .map((r) => `<li>${esc(r)}</li>`)
            .join("")}</ol>
        </section>`
      : "";

  const checklistHtml =
    checklist.length > 0
      ? `<section>
          <h2>צ׳ק־ליסט מלא</h2>
          ${checklist
            .map((section) => {
              const sectionTitle =
                section.section_title ||
                getChecklistSectionTitle(section.section_id) ||
                `סעיף ${section.section_id}`;
              return `
                <div class="check-section">
                  <div class="check-head">
                    <span class="num">${esc(section.section_id)}</span>
                    <span>${esc(sectionTitle)}</span>
                  </div>
                  <div class="check-items">
                    ${(section.items ?? [])
                      .map((item) => {
                        const title =
                          item.title ||
                          getChecklistItemTitle(item.item_id) ||
                          item.item_id;
                        return `
                          <div class="check-item">
                            <div class="check-item-top">
                              <div><span class="num">${esc(item.item_id)}</span> ${esc(title)}</div>
                              ${statusBadge(item.status)}
                            </div>
                            ${
                              item.severity
                                ? `<div class="small">חומרה: ${esc(
                                    FINDING_SEVERITY_LABELS[item.severity] ??
                                      item.severity,
                                  )}</div>`
                                : ""
                            }
                            ${item.what_happened ? `<div class="small">מה קרה: ${esc(item.what_happened)}</div>` : ""}
                            ${item.evidence ? `<div class="small">ראיה: ${esc(item.evidence)}</div>` : ""}
                            ${item.should_have ? `<div class="small">מה היה צריך: ${esc(item.should_have)}</div>` : ""}
                          </div>`;
                      })
                      .join("")}
                  </div>
                </div>`;
            })
            .join("")}
        </section>`
      : "";

  const safeTitle = (input.customerName || "דוח-בקרת-שיחה").replace(
    /[\\/:*?"<>|]+/g,
    "-",
  );

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>דוח בקרת שיחה — ${esc(safeTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f4f4ef;
      --surface: #ffffff;
      --ink: #111111;
      --muted: #6b6b63;
      --line: rgba(17,17,17,0.08);
      --highlight: #ffe100;
      --ok: #e8f5c8;
      --warn: #fef3c7;
      --bad: #fee2e2;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Rubik, system-ui, sans-serif;
      color: var(--ink);
      background: var(--bg);
      direction: rtl;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      background: rgba(244,244,239,0.96);
      border-bottom: 1px solid var(--line);
    }
    .toolbar p { margin: 0; font-size: 12px; color: var(--muted); }
    .btn {
      border: 0;
      border-radius: 12px;
      background: #111;
      color: #fff;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      padding: 10px 14px;
      cursor: pointer;
    }
    .btn-secondary {
      background: #fff;
      color: #111;
      border: 1px solid var(--line);
    }
    .page {
      max-width: 880px;
      margin: 18px auto 40px;
      background: var(--surface);
      border-radius: 20px;
      border: 1px solid var(--line);
      padding: 28px;
      box-shadow: 0 10px 30px rgba(17,17,17,0.05);
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 18px;
      border-bottom: 3px solid var(--highlight);
      margin-bottom: 22px;
    }
    .brand-text h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
    }
    .brand-text p {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--muted);
    }
    .logo {
      width: 54px;
      height: 54px;
      object-fit: contain;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 700;
      color: var(--muted);
      letter-spacing: 0.01em;
    }
    section { margin-top: 22px; page-break-inside: avoid; }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 18px;
      background: var(--bg);
      border-radius: 16px;
      padding: 14px 16px;
    }
    .kv { display: grid; gap: 2px; }
    .k { font-size: 11px; color: var(--muted); }
    .v { font-size: 14px; font-weight: 600; line-height: 1.45; }
    .scores {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .score {
      background: var(--bg);
      border-radius: 14px;
      padding: 12px;
    }
    .score-main { background: rgba(255,225,0,0.35); }
    .score-label { font-size: 11px; color: var(--muted); }
    .score-value { margin-top: 4px; font-size: 18px; font-weight: 700; }
    .panel {
      background: var(--bg);
      border-radius: 14px;
      padding: 12px 14px;
      display: grid;
      gap: 8px;
    }
    .panel.muted { color: var(--muted); font-size: 13px; }
    .body { margin: 0; font-size: 14px; line-height: 1.7; }
    .stack { display: grid; gap: 8px; }
    .critical {
      border: 1px solid #fecaca;
      background: #fef2f2;
      border-radius: 14px;
      padding: 12px;
    }
    .critical-title { font-weight: 700; color: #991b1b; }
    .small { margin-top: 4px; font-size: 12px; color: var(--muted); line-height: 1.5; }
    ul, ol { margin: 0; padding-inline-start: 1.2rem; }
    li { margin: 0.35rem 0; line-height: 1.55; font-size: 14px; }
    .check-section {
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .check-head {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--bg);
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 700;
    }
    .check-items { display: grid; }
    .check-item {
      padding: 10px 12px;
      border-top: 1px solid var(--line);
      font-size: 12px;
    }
    .check-item-top {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
    }
    .num {
      display: inline-flex;
      min-width: 1.6rem;
      justify-content: center;
      font-variant-numeric: tabular-nums;
      color: var(--muted);
      font-weight: 600;
    }
    .badge {
      display: inline-flex;
      border-radius: 8px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      background: #fff;
      color: var(--muted);
      white-space: nowrap;
    }
    .badge-ok { background: var(--ok); color: #111; }
    .badge-warn { background: var(--warn); color: #78350f; }
    .badge-bad { background: var(--bad); color: #7f1d1d; }
    .footer {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      font-size: 11px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .note {
      margin-top: 10px;
      font-size: 11px;
      color: var(--muted);
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .page {
        margin: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        max-width: none;
        padding: 0;
      }
      a { color: inherit; text-decoration: none; }
    }
    @media (max-width: 720px) {
      .meta, .scores { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <p>הדוח ללא תמלול. לשמירה כ־PDF בחרו «שמירה כ־PDF» בחלון ההדפסה.</p>
    <div style="display:flex;gap:8px;">
      <button class="btn" type="button" onclick="window.print()">הורדת PDF</button>
      <button class="btn btn-secondary" type="button" onclick="window.close()">סגירה</button>
    </div>
  </div>
  <main class="page">
    <header class="brand">
      <div class="brand-text">
        <h1>דוח בקרת שיחה</h1>
        <p>ליבה ביטוח · סוכן בקרת שיחות</p>
      </div>
      <img class="logo" src="${esc(input.logoUrl || "/brand/liba-logo.png")}" alt="ליבה" />
    </header>

    <section>
      <h2>פרטי השיחה</h2>
      <div class="meta">${metaGrid}</div>
      ${
        input.driveUrl
          ? `<p class="note">קישור להקלטה: <a href="${esc(input.driveUrl)}" dir="ltr">${esc(input.driveUrl)}</a></p>`
          : ""
      }
      <p class="note">הדוח אינו כולל תמלול.</p>
    </section>

    ${analysis ? `<section><h2>ציונים</h2>${scoreCards}</section>` : `<section><div class="panel muted">אין ניתוח עדיין</div></section>`}
    ${summaryHtml}
    ${identificationHtml}
    ${analysis ? criticalHtml : ""}
    ${doneWellHtml}
    ${gapsHtml}
    ${recommendationsHtml}
    ${checklistHtml}

    <footer class="footer">
      <span>הופק מליבה OS</span>
      <span>${esc(generatedAt)}</span>
    </footer>
  </main>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 450);
    });
  </script>
</body>
</html>`;
}

export function openCallReportPdf(input: CallReportPdfInput): boolean {
  const html = buildCallReportPdfHtml({
    ...input,
    logoUrl:
      input.logoUrl ||
      (typeof window !== "undefined"
        ? `${window.location.origin}/brand/liba-logo.png`
        : "/brand/liba-logo.png"),
  });

  // Blob URL avoids about:blank + noopener issues in Edge/Chrome.
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank");
  if (!popup) {
    URL.revokeObjectURL(url);
    return false;
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return true;
}
