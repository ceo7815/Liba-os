"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MenuField } from "@/components/admin/menu-field";
import { previewInvoice, receiveInvoice, storeInvoiceFile } from "@/lib/store/invoice-intake";

type Product = { handle: string; name: string };
type Line = { handle: string; qty: number; serials: string[] };

function resize(serials: string[], qty: number) {
  const next = serials.slice(0, qty);
  while (next.length < qty) next.push("");
  return next;
}

export function InvoiceIntake({ products }: { products: Product[] }) {
  const t = useTranslations("stock");
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const fallback = products[0]?.handle ?? "";

  async function read() {
    if (!file) return;
    setBusy("read");
    setNote("");
    const data = new FormData();
    data.set("file", file);
    const result = await previewInvoice(data);
    setBusy(null);
    if ("error" in result) {
      setNote(t("errors.file"));
      return;
    }
    setReference(result.reference);
    const read = result.lines.length > 0 ? result.lines : [{ handle: fallback, qty: 1 }];
    setLines(read.map((line) => ({ handle: line.handle, qty: Math.min(40, line.qty), serials: Array.from({ length: Math.min(40, line.qty) }, () => "") })));
    setNote(result.unread || result.lines.length === 0 ? t("unread") : "");
  }

  async function save() {
    const ready = lines
      .filter((line) => line.handle && line.qty > 0)
      .map((line) => ({ ...line, serials: line.serials.map((serial) => serial.trim()).filter(Boolean) }));
    if (!reference.trim() || ready.length === 0) {
      setNote(t("errors.fields"));
      return;
    }
    if (ready.some((line) => line.serials.length !== line.qty)) {
      setNote(t("errors.serial"));
      return;
    }
    setBusy("save");
    let path = "";
    if (file) {
      const data = new FormData();
      data.set("file", file);
      const stored = await storeInvoiceFile(data);
      if ("path" in stored) path = stored.path;
    }
    const result = await receiveInvoice({ reference, file: path, lines: ready });
    setBusy(null);
    if ("error" in result) {
      setNote(result.error === "auth" ? t("errors.stock") : t(`errors.${result.error}`));
      return;
    }
    setFile(null);
    setReference("");
    setLines([]);
    setNote("");
    router.refresh();
  }

  return (
    <section className="work-sheet grid gap-4 px-4 py-4">
      <div>
        <h2 className="text-sm font-medium">{t("intake")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intakeHelp")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-64 flex-1 gap-1 text-sm">
          <span className="text-muted-foreground">{t("file")}</span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setLines([]);
              setNote("");
            }}
            className="h-10 rounded-full border border-black/10 bg-transparent px-3 text-sm file:me-3 file:border-0 file:bg-transparent file:text-sm"
          />
        </label>
        <button
          type="button"
          disabled={!file || busy !== null}
          onClick={() => void read()}
          className="press h-10 rounded-full bg-primary px-5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {busy === "read" ? t("reading") : t("read")}
        </button>
      </div>
      {lines.length > 0 ? (
        <div className="grid gap-3">
          <label className="grid max-w-xs gap-1 text-sm">
            <span className="text-muted-foreground">{t("columns.reference")}</span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className="h-10 rounded-full border border-black/10 bg-transparent px-3 outline-none"
            />
          </label>
          {lines.map((line, index) => (
            <div key={`${line.handle}-${index}`} className="grid gap-3 border-t border-black/10 pt-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
                <MenuField
                  label={t("columns.product")}
                  value={line.handle || fallback}
                  onChange={(value) => setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, handle: value } : item)))}
                  options={products.map((product) => ({ value: product.handle, label: product.name }))}
                />
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">{t("columns.qty")}</span>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={line.qty}
                    onChange={(event) => {
                      const qty = Math.min(40, Math.max(1, Number(event.target.value) || 1));
                      setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, qty, serials: resize(item.serials, qty) } : item)));
                    }}
                    className="h-10 rounded-full border border-black/10 bg-transparent px-3 outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="h-10 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  {t("removeLine")}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {line.serials.map((serial, serialIndex) => (
                  <label key={`${index}-${serialIndex}`} className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">
                      {t("serial")} {serialIndex + 1}
                    </span>
                    <input
                      dir="ltr"
                      value={serial}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, serials: item.serials.map((value, valueIndex) => (valueIndex === serialIndex ? event.target.value : value)) }
                              : item,
                          ),
                        )
                      }
                      className="h-10 rounded-full border border-black/10 bg-transparent px-3 text-start outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLines((current) => [...current, { handle: fallback, qty: 1, serials: [""] }])}
              className="h-10 rounded-full border border-black/10 px-4 text-sm"
            >
              {t("addLine")}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void save()}
              className="press h-10 rounded-full bg-primary px-5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {busy === "save" ? t("saving") : t("addStock")}
            </button>
          </div>
        </div>
      ) : null}
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </section>
  );
}
