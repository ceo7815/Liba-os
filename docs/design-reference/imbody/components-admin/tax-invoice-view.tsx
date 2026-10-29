import { lineAmounts, type TaxInvoice } from "@/lib/finance/invoice-pdf";

function aed(amount: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function TaxInvoiceView({ invoice, arabicClassName }: { invoice: TaxInvoice; arabicClassName?: string }) {
  const rows = invoice.lines.map((item) => ({ item, ...lineAmounts(item) }));
  const net = rows.reduce((sum, row) => sum + row.net, 0);
  const vat = rows.reduce((sum, row) => sum + row.vat, 0);
  const gross = net + vat;
  const quote = invoice.kind === "quote";
  return (
    <article className="paper mx-auto w-full max-w-3xl bg-white px-8 py-8 text-[#1f1f1e] shadow-[0_16px_40px_rgb(28_28_27_/_8%)]">
      <div className="h-2 bg-[#1d4333]" />
      <header className="mt-6 flex items-start justify-between gap-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/imbody/logo.webp" alt="IMBODY" className="h-8 w-auto" />
          <p className="mt-4 text-sm font-medium">{invoice.supplier.name || "—"}</p>
          <p className="mt-1 max-w-xs text-xs text-[#52514e]">{invoice.supplier.address || "—"}</p>
          <p className="mt-2 text-xs">TRN {invoice.supplier.trn || "—"}</p>
        </div>
        <div className="text-end">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#1d4333]">{quote ? "Quotation" : "Tax Invoice"}</h1>
          <p className={`mt-1 text-lg text-[#1d4333] ${arabicClassName ?? ""}`} dir="rtl">{quote ? "عرض سعر" : "فاتورة ضريبية"}</p>
          <p className="text-sm text-[#52514e]" dir="rtl">{quote ? "הצעת מחיר" : "חשבונית מס"}</p>
          <p className="mt-3 text-sm font-medium">{invoice.number}</p>
          <p className="text-xs text-[#52514e]">Issued {invoice.issued}</p>
          <p className="text-xs text-[#52514e]">Supply {invoice.supplied}</p>
        </div>
      </header>
      <section className="mt-6 rounded-xl bg-[#f4f4f2] px-4 py-3">
        <p className="text-[11px] text-[#52514e]">Bill to</p>
        <p className="mt-1 text-sm font-medium">{invoice.customer.name || "—"}</p>
        <p className="text-xs text-[#52514e]">{invoice.customer.address || "—"}</p>
        {invoice.customer.trn ? <p className="mt-1 text-xs">TRN {invoice.customer.trn}</p> : null}
      </section>
      <table className="mt-6 w-full text-xs">
        <thead className="bg-[#1d4333] text-white">
          <tr>
            <th className="px-2 py-2 text-start font-medium">Description</th>
            <th className="px-2 py-2 text-end font-medium">Qty</th>
            <th className="px-2 py-2 text-end font-medium">Unit</th>
            <th className="px-2 py-2 text-end font-medium">Discount</th>
            <th className="px-2 py-2 text-end font-medium">VAT %</th>
            <th className="px-2 py-2 text-end font-medium">VAT</th>
            <th className="px-2 py-2 text-end font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.item.description}-${row.item.qty}`} className="border-b border-[#e4e2dc]">
              <td className="px-2 py-2">
                <span className="block">{row.item.description}</span>
                {row.item.descriptionAr ? <span className={`block text-[#52514e] ${arabicClassName ?? ""}`} dir="rtl">{row.item.descriptionAr}</span> : null}
              </td>
              <td className="px-2 py-2 text-end tabular-nums">{row.item.qty}</td>
              <td className="px-2 py-2 text-end tabular-nums">{aed(row.item.unitPrice)}</td>
              <td className="px-2 py-2 text-end tabular-nums">{aed(row.item.discount)}</td>
              <td className="px-2 py-2 text-end tabular-nums">{row.item.vatRate}%</td>
              <td className="px-2 py-2 text-end tabular-nums">{aed(row.vat)}</td>
              <td className="px-2 py-2 text-end tabular-nums">{aed(row.gross)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ms-auto mt-4 grid w-64 gap-1 text-sm">
        <div className="flex justify-between"><dt>Excl. VAT</dt><dd className="tabular-nums">{aed(net)}</dd></div>
        <div className="flex justify-between"><dt>VAT</dt><dd className="tabular-nums">{aed(vat)}</dd></div>
        <div className="flex justify-between text-base font-semibold text-[#1d4333]"><dt>Total AED</dt><dd className="tabular-nums">{aed(gross)}</dd></div>
      </dl>
      <p className="mt-6 text-xs text-[#52514e]">Payment {invoice.payment.method || "—"}{invoice.payment.reference ? ` · ${invoice.payment.reference}` : ""}</p>
    </article>
  );
}
