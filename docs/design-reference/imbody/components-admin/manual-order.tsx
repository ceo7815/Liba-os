"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MenuField } from "@/components/admin/menu-field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { placeManualOrder } from "@/lib/store/manual-order";

type Product = { handle: string; name: string };
type Line = { handle: string; qty: number };

const emirates = ["Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras al-Khaimah", "Sharjah", "Umm al-Quwain"] as const;
const emirateKey = {
  "Abu Dhabi": "abuDhabi",
  Ajman: "ajman",
  Dubai: "dubai",
  Fujairah: "fujairah",
  "Ras al-Khaimah": "rak",
  Sharjah: "sharjah",
  "Umm al-Quwain": "uaq",
} as const;

export function ManualOrder({
  products,
  initial,
}: {
  products: Product[];
  initial?: { open?: boolean; name?: string; handle?: string; phone?: string; email?: string; street?: string; city?: string; emirate?: string };
}) {
  const t = useTranslations("ordersDesk");
  const router = useRouter();
  const emiratesSafe = emirates.includes(initial?.emirate as (typeof emirates)[number]) ? (initial?.emirate as (typeof emirates)[number]) : "Dubai";
  const [open, setOpen] = useState(Boolean(initial?.open));
  const [source, setSource] = useState<"phone" | "b2b">("phone");
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [street, setStreet] = useState(initial?.street ?? "");
  const [city, setCity] = useState(initial?.city || "Dubai");
  const [emirate, setEmirate] = useState<(typeof emirates)[number]>(emiratesSafe);
  const [paid, setPaid] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ handle: initial?.handle || products[0]?.handle || "", qty: 1 }]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setNote("");
    const result = await placeManualOrder({ source, name, phone, email, street, city, emirate, paid, lines });
    setBusy(false);
    if ("error" in result) {
      setNote(t(result.error === "fields" ? "manual.fields" : "manual.failed"));
      return;
    }
    setOpen(false);
    setName("");
    setPhone("");
    setEmail("");
    setStreet("");
    setPaid(false);
    setLines([{ handle: products[0]?.handle ?? "", qty: 1 }]);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="press inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm text-primary-foreground">
        {t("manual.open")}
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(44rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4 pe-14">
          <DialogTitle>{t("manual.open")}</DialogTitle>
          <DialogDescription>{t("manual.help")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <MenuField
              label={t("manual.source")}
              value={source}
              onChange={(value) => setSource(value === "b2b" ? "b2b" : "phone")}
              options={[
                { value: "phone", label: t("manual.phoneSource") },
                { value: "b2b", label: t("manual.b2bSource") },
              ]}
            />
            <MenuField
              label={t("manual.pay")}
              value={paid ? "paid" : "later"}
              onChange={(value) => setPaid(value === "paid")}
              options={[
                { value: "later", label: t("manual.later") },
                { value: "paid", label: t("manual.paid") },
              ]}
            />
            <Field label={t("manual.customer")} value={name} onChange={setName} />
            <Field label={t("manual.phone")} value={phone} onChange={setPhone} />
            <Field label={t("manual.email")} value={email} onChange={setEmail} />
            <Field label={t("manual.city")} value={city} onChange={setCity} />
            <Field label={t("manual.street")} value={street} onChange={setStreet} className="sm:col-span-2" />
            <MenuField
              label={t("columns.delivery")}
              value={emirate}
              onChange={(value) => setEmirate(emirates.find((item) => item === value) ?? "Dubai")}
              options={emirates.map((item) => ({ value: item, label: t(`manual.emirates.${emirateKey[item]}`) }))}
            />
          </div>
          {lines.map((line, index) => (
            <div key={`${line.handle}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_6rem]">
              <MenuField
                label={t("lines")}
                value={line.handle}
                onChange={(value) => setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, handle: value } : item)))}
                options={products.map((product) => ({ value: product.handle, label: product.name }))}
              />
              <Field
                label={t("qty")}
                value={String(line.qty)}
                onChange={(value) => setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, qty: Number(value) } : item)))}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((current) => [...current, { handle: products[0]?.handle ?? "", qty: 1 }])}
            className="h-10 w-fit rounded-full border border-border px-4 text-sm"
          >
            {t("manual.addLine")}
          </button>
          {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        </div>
        <div className="border-t border-border px-5 py-3">
          <button
            type="button"
            disabled={busy || products.length === 0}
            onClick={() => void save()}
            className="press h-10 rounded-full bg-primary px-5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {busy ? t("manual.saving") : t("manual.save")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 text-sm ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-full border border-border bg-transparent px-3 outline-none"
      />
    </label>
  );
}
