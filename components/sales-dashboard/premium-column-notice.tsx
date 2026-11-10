import { missingPremiumColumnWarnings } from "@/lib/sales-dashboard/workbook-grid";
import type { SalesWorkbook } from "@/lib/sales-dashboard/workbook-grid";

export function PremiumColumnNotice({
  workbook,
}: {
  workbook: SalesWorkbook | null | undefined;
}) {
  const warnings = missingPremiumColumnWarnings(workbook);
  if (!warnings.length) return null;
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold leading-relaxed text-amber-950"
    >
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </div>
  );
}
