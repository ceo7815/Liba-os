"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { Panel, Stat } from "@/components/shemesh/widgets";
import { field, ModulePage } from "@/components/shemesh/module-shell";
import { formatShemeshCount, formatShemeshMoney } from "@/lib/shemesh/format";
import { monthsToClear, withVat } from "@/lib/shemesh/calculators";

export function FixedCostsScreen() {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState<"exclusive" | "inclusive">("exclusive");
  const [balance, setBalance] = useState("");
  const [monthly, setMonthly] = useState("");
  const [rows, setRows] = useState<{ title: string; gross: number }[]>([]);
  const gross = withVat(Number(amount) || 0, vat);
  const months = monthsToClear(Number(balance) || 0, Number(monthly) || 0);
  const total = rows.reduce((sum, row) => sum + row.gross, 0);

  return (
    <ModulePage
      title="הוצאות קבועות"
      description="סעיפים, מע״מ, ויתרה מול החזר חודשי. הסכומים מוקלדים כאן ולא שמורים בקוד."
      icon={Receipt}
      emptyTitle="אין עדיין סעיפים במסד"
      emptyBody="טבלאות shemesh_fixed_costs ו־shemesh_obligations יושבות במיגרציה ולא הורצו לייצור. אפשר להוסיף סעיף לחישוב מקומי. המסך לא נשען על הטבלה ולא קורס בלעדיה."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="סעיפים במסך" value={formatShemeshCount(rows.length)} />
        <Stat label="סה״כ כולל מע״מ" value={rows.length ? formatShemeshMoney(total) : "—"} />
        <Stat label="חודשים לכיסוי יתרה" value={months == null ? "—" : formatShemeshCount(months)} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="סעיף">
          <div className="grid gap-2">
            <input className={field} placeholder="שם הסעיף" value={title} onChange={(event) => setTitle(event.target.value)} />
            <input className={field} inputMode="decimal" placeholder="סכום" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <select className={field} value={vat} onChange={(event) => setVat(event.target.value as "exclusive" | "inclusive")} aria-label="מע״מ">
              <option value="exclusive">לפני מע״מ</option>
              <option value="inclusive">כולל מע״מ</option>
            </select>
            <button
              type="button"
              className="h-9 rounded-xl bg-primary px-3 text-sm text-primary-foreground"
              onClick={() => {
                if (!title.trim()) return;
                setRows((current) => [...current, { title: title.trim(), gross }]);
                setTitle("");
                setAmount("");
              }}
            >
              הוספה · {formatShemeshMoney(gross)}
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {rows.length === 0 ? <li className="text-muted-foreground">אין סעיפים במסך הזה עדיין.</li> : null}
            {rows.map((row) => (
              <li key={row.title} className="flex justify-between gap-2">
                <span>{row.title}</span>
                <span className="tabular-nums">{formatShemeshMoney(row.gross)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="יתרה והחזר">
          <div className="grid gap-2">
            <input className={field} inputMode="decimal" placeholder="יתרה" value={balance} onChange={(event) => setBalance(event.target.value)} />
            <input className={field} inputMode="decimal" placeholder="החזר חודשי" value={monthly} onChange={(event) => setMonthly(event.target.value)} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {months == null ? "הזינו יתרה והחזר כדי לראות כמה חודשים נשארו." : `${formatShemeshCount(months)} חודשים עד לכיסוי.`}
          </p>
        </Panel>
      </div>
    </ModulePage>
  );
}
