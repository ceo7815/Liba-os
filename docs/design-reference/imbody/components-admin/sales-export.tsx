"use client";

import { useTranslations } from "next-intl";

export function SalesExport({ rows }: { rows: { number: number; source: string; campaign: string; total: number }[] }) {
  const t = useTranslations("salesDesk");
  function download() {
    const lines = ["number,source,campaign,total", ...rows.map((row) => `${row.number},${row.source},${row.campaign},${row.total}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return <button type="button" onClick={download} className="press h-9 rounded-full border border-border px-3 text-sm">{t("export")}</button>;
}
