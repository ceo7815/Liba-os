import {
  formatReportDay,
  formatReportMoney,
  parseReportAmount,
  reportLines,
  reportTotals,
  sideTotal,
  type PortfolioReport,
  type ReportSide,
} from "@/lib/shemesh/portfolio-report";

export function PortfolioReportDocument({ report }: { report: PortfolioReport }) {
  const totals = reportTotals(report);
  const family = report.familyName.trim() || "משפחה";

  return (
    <article className="liba-report w-full bg-white text-[#161616]" dir="rtl">
      <header className="flex items-center justify-between gap-4 border-t-[6px] border-[#FFD400] border-b border-[#ececec] py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/liba-logo.png" alt="ליבה" className="h-14 w-auto" />
        <div className="text-left">
          <strong className="block text-[15px]">ליבה סוכנות לביטוח</strong>
          <span className="text-[11px] text-[#5c5c5c]">ניהול תיקי ביטוח · ייעוץ ובקרה</span>
        </div>
      </header>

      <h1 className="mb-0.5 mt-3 text-xl font-semibold tracking-tight">השוואת תיק ביטוחי · {family}</h1>
      <p className="mb-2.5 text-[11.5px] text-[#444]">
        מנהל תיק לקוח: {report.manager || "—"}
        {" · "}מעודכן ל־{formatReportDay(report.updatedOn)}
        {report.existingCaption ? ` · מימין — מצב קיים (${report.existingCaption})` : " · מימין — מצב קיים"}
        {report.proposedCaption ? ` · משמאל — מצב חדש (${report.proposedCaption})` : " · משמאל — מצב חדש"}
      </p>

      <div className="grid grid-cols-2 border border-[#e6e6e6] sm:grid-cols-4">
        <Kpi label="עלות חודשית — מצב קיים" value={formatReportMoney(totals.existing)} />
        <Kpi label="עלות חודשית — מצב חדש" value={formatReportMoney(totals.proposed)} />
        <Kpi label="הפרש חודשי" value={formatReportMoney(-totals.diff)} save />
        <Kpi label="הפרש שנתי" value={formatReportMoney(-totals.annual)} save />
      </div>

      {report.blocks.map((block) => {
        const existing = sideTotal(block.existing);
        const proposed = sideTotal(block.proposed);
        const diff = existing - proposed;
        return (
          <section key={block.id} className="report-block mt-2">
            <h2 className="bg-[#161616] px-2.5 py-1.5 text-xs font-semibold text-white">{block.title || "תחום"}</h2>
            <div className="grid grid-cols-2 border border-t-0 border-[#e6e6e6]">
              <span className="bg-[#FFD400] px-2.5 py-1 text-[11px] font-bold">מצב קיים</span>
              <span className="border-r border-[#e4c200] bg-[#FFD400] px-2.5 py-1 text-[11px] font-bold">מצב חדש</span>
            </div>
            <div className="grid grid-cols-2 border border-t-0 border-[#e6e6e6]">
              <SideView side={block.existing} existing />
              <SideView side={block.proposed} diff={diff} />
            </div>
          </section>
        );
      })}

      <table className="mt-3 w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-[#161616] text-white">
            <th className="border border-[#e6e6e6] px-1.5 py-1 text-right font-semibold">תחום</th>
            <th className="border border-[#e6e6e6] px-1.5 py-1 text-right font-semibold">מצב קיים</th>
            <th className="border border-[#e6e6e6] px-1.5 py-1 text-right font-semibold">מצב חדש</th>
            <th className="border border-[#e6e6e6] px-1.5 py-1 text-right font-semibold">הפרש חודשי</th>
            <th className="border border-[#e6e6e6] px-1.5 py-1 text-right font-semibold">הפרש שנתי</th>
          </tr>
        </thead>
        <tbody>
          {totals.rows.map((row) => (
            <tr key={row.id}>
              <td className="border border-[#e6e6e6] px-1.5 py-1">{row.title}</td>
              <td className="border border-[#e6e6e6] px-1.5 py-1">{formatReportMoney(row.existing)}</td>
              <td className="border border-[#e6e6e6] px-1.5 py-1">{formatReportMoney(row.proposed)}</td>
              <td className="border border-[#e6e6e6] px-1.5 py-1">{diffLabel(row.diff)}</td>
              <td className="border border-[#e6e6e6] px-1.5 py-1">{diffLabel(row.annual)}</td>
            </tr>
          ))}
          <tr className="bg-[#fff8cc] font-bold">
            <td className="border border-[#e6e6e6] px-1.5 py-1">סה״כ</td>
            <td className="border border-[#e6e6e6] px-1.5 py-1">{formatReportMoney(totals.existing)}</td>
            <td className="border border-[#e6e6e6] px-1.5 py-1">{formatReportMoney(totals.proposed)}</td>
            <td className="border border-[#e6e6e6] px-1.5 py-1">{diffLabel(totals.diff)}</td>
            <td className="border border-[#e6e6e6] px-1.5 py-1">{diffLabel(totals.annual)}</td>
          </tr>
        </tbody>
      </table>

      {reportLines(report.gains).length > 0 ? (
        <>
          <h3 className="mb-1 mt-3 text-[13px] font-semibold">מה מקבלים לצד החיסכון של {formatReportMoney(totals.diff)} בחודש</h3>
          <ul className="m-0 list-disc pe-4">
            {reportLines(report.gains).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}

      {reportLines(report.checks).length > 0 ? (
        <>
          <h3 className="mb-1 mt-3 text-[13px] font-semibold">לבדיקה לפני מעבר</h3>
          <ul className="m-0 list-disc pe-4">
            {reportLines(report.checks).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="mt-2 text-[10.5px] text-[#333]">
        <strong>המחיר יכול להשתנות לפי החלטת החברה.</strong> מסמך זה הוא ריכוז והשוואה בלבד ואינו מחליף את תנאי הפוליסות וההצעות המלאים. ההצעה כפופה לחיתום ולאישור סופי של חברת הביטוח.
      </p>

      <footer className="mt-3 flex items-center justify-between gap-3 border-t-[5px] border-[#FFD400] pt-1.5 text-[10.5px] text-[#333]">
        <span>הופק ב־{formatReportDay(report.updatedOn)} · מנהל תיק לקוח: {report.manager || "—"}</span>
        <span>ליבה סוכנות לביטוח{report.phone ? ` · ${report.phone}` : ""}</span>
      </footer>
    </article>
  );
}

function Kpi({ label, value, save }: { label: string; value: string; save?: boolean }) {
  return (
    <div className={save ? "border-l border-[#e6e6e6] bg-[#fff8cc] px-2.5 py-2 last:border-l-0" : "border-l border-[#e6e6e6] px-2.5 py-2 last:border-l-0"}>
      <p className="text-[10px] text-[#666]">{label}</p>
      <p className="mt-0.5 text-base font-bold tracking-tight">{value}</p>
    </div>
  );
}

function SideView({ side, existing, diff }: { side: ReportSide; existing?: boolean; diff?: number }) {
  const lines = reportLines(side.lines);
  const notes = reportLines(side.note);
  const total = sideTotal(side);
  const lastIsTotal = side.costs.length > 0 && parseReportAmount(side.costs[side.costs.length - 1].amount) === total;
  return (
    <div className={existing ? "border-l border-[#e6e6e6] bg-[#fafafa] px-2.5 py-2" : "px-2.5 py-2"}>
      {side.title ? <p className="mb-1 font-semibold">{side.title}</p> : null}
      {notes.map((note) => (
        <p key={note} className="mb-1 text-[11px]">{note}</p>
      ))}
      {lines.length > 0 ? (
        <ul className="m-0 list-disc pe-4">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {side.costs.map((cost, index) => (
        <div key={cost.id} className="mt-1.5 flex items-center justify-between gap-2 border-t border-[#ececec] pt-1 font-bold">
          <span>{cost.label || "עלות"}</span>
          <span>
            {formatReportMoney(parseReportAmount(cost.amount))}
            {!existing && diff && lastIsTotal && index === side.costs.length - 1 ? <Savings diff={diff} /> : null}
          </span>
        </div>
      ))}
      {!lastIsTotal ? (
        <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-[#ececec] pt-1 font-bold">
          <span>עלות חודשית</span>
          <span>
            {formatReportMoney(total)}
            {!existing && diff ? <Savings diff={diff} /> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Savings({ diff }: { diff: number }) {
  return (
    <span className="me-1 inline-block bg-[#FFD400] px-1.5 text-[10px] font-bold">
      {diff > 0 ? `חיסכון ${formatReportMoney(diff)}` : `תוספת ${formatReportMoney(-diff)}`}
    </span>
  );
}

function diffLabel(diff: number): string {
  if (diff === 0) return formatReportMoney(0);
  if (diff > 0) return `${formatReportMoney(diff)} חיסכון`;
  return `${formatReportMoney(-diff)} תוספת`;
}
