"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { openShopifyStock } from "@/lib/store/stock";

type Product = { handle: string; name: string };
type Row = { handle: string; name: string; qty: number; serials: string[] };

function resize(serials: string[], qty: number) {
  const next = serials.slice(0, qty);
  while (next.length < qty) next.push("");
  return next;
}

export function OpeningCount({ products }: { products: Product[] }) {
  const t = useTranslations("stock");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(products.map((product) => ({ ...product, qty: 1, serials: [""] })));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function setQty(handle: string, qty: number) {
    const next = Math.min(40, Math.max(1, qty || 1));
    setRows((current) => current.map((row) => (row.handle === handle ? { ...row, qty: next, serials: resize(row.serials, next) } : row)));
  }

  function setSerial(handle: string, index: number, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.handle === handle ? { ...row, serials: row.serials.map((serial, serialIndex) => (serialIndex === index ? value : serial)) } : row,
      ),
    );
  }

  async function save() {
    const lines = rows
      .map((row) => ({ handle: row.handle, qty: row.qty, serials: row.serials.map((serial) => serial.trim()).filter(Boolean) }))
      .filter((row) => row.serials.length > 0);
    if (lines.length === 0 || lines.some((line) => line.serials.length !== line.qty)) {
      setNote(t("errors.serial"));
      return;
    }
    setBusy(true);
    setNote("");
    const result = await openShopifyStock({ lines: lines.map(({ handle, serials }) => ({ handle, serials })) });
    setBusy(false);
    if ("error" in result) {
      setNote(result.error === "auth" ? t("errors.stock") : t(`errors.${result.error}`));
      return;
    }
    router.refresh();
  }

  if (products.length === 0) return null;

  return (
    <section className="work-sheet grid gap-4 px-4 py-4">
      <div>
        <h2 className="text-sm font-medium">{t("opening")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("openingHelp")}</p>
      </div>
      {rows.map((row) => (
        <div key={row.handle} className="grid gap-3 border-t border-black/10 pt-3">
          <div className="flex flex-wrap items-end gap-3">
            <p className="min-w-40 flex-1 text-sm font-medium">{row.name}</p>
            <label className="grid w-24 gap-1 text-sm">
              <span className="text-muted-foreground">{t("columns.qty")}</span>
              <input
                type="number"
                min={1}
                max={40}
                value={row.qty}
                onChange={(event) => setQty(row.handle, Number(event.target.value))}
                className="h-10 rounded-full border border-black/10 bg-transparent px-3 outline-none"
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {row.serials.map((serial, index) => (
              <label key={`${row.handle}-${index}`} className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  {t("serial")} {index + 1}
                </span>
                <input
                  dir="ltr"
                  value={serial}
                  onChange={(event) => setSerial(row.handle, index, event.target.value)}
                  className="h-10 rounded-full border border-black/10 bg-transparent px-3 text-start outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="press h-10 rounded-full bg-primary px-5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {busy ? t("saving") : t("openingSave")}
        </button>
      </div>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </section>
  );
}
