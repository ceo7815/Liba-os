"use client";

import { useFormState } from "react-dom";
import { field } from "@/components/shemesh/module-shell";
import { Panel } from "@/components/shemesh/widgets";
import { chooseShemeshGoogleCustomer, connectShemeshProvider, connectShemeshSurense } from "@/app/actions/shemesh-connect";
import type { ShemeshLink } from "@/lib/shemesh/connect";

const idle = { error: null as string | null };

export function ShemeshConnectPanel({
  links,
  googleChoices,
  missing,
}: {
  links: ShemeshLink[];
  googleChoices: string[];
  missing: boolean;
}) {
  const [providerState, providerAction] = useFormState(connectShemeshProvider, idle);
  const [surenseState, surenseAction] = useFormState(connectShemeshSurense, idle);
  const [googleState, googleAction] = useFormState(chooseShemeshGoogleCustomer, idle);
  return (
    <div className="space-y-3">
      {missing ? (
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          טבלאות החיבור עדיין לא הורצו. אפשר לפתוח את מסכי ההתחברות, והשמירה תחכה למיגרציה.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <article key={link.id} className="app-surface px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{link.name}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${link.connected ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                {link.connected ? "מחובר" : "לא מחובר"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{link.note || "אין סטטוס"}</p>
          </article>
        ))}
      </div>
      <Panel title="פייסבוק וגוגל">
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm text-primary-foreground" href="/api/shemesh/facebook/connect">
            חיבור פייסבוק שמש
          </a>
          <a className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm text-primary-foreground" href="/api/shemesh/google/connect">
            חיבור גוגל שמש
          </a>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">חשבון המודעות של שמש קבוע. בגוגל בוחרים את החשבון מתוך ה־MCC אחרי ההתחברות.</p>
        {googleChoices.length ? (
          <form action={googleAction} className="mt-3 flex flex-wrap items-center gap-2">
            <select className={field} name="customerId" aria-label="חשבון גוגל">
              {googleChoices.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-xl bg-primary px-3 text-sm text-primary-foreground">שמירת חשבון שמש</button>
            {googleState.error ? <span className="text-sm text-destructive">{googleState.error}</span> : null}
          </form>
        ) : null}
      </Panel>
      <Panel title="שורנס">
        <form action={surenseAction} className="grid gap-2 sm:grid-cols-2">
          <select className={field} name="mode" defaultValue="same" aria-label="מצב סוכנות">
            <option value="same">אותה סוכנות, סינון שמש</option>
            <option value="separate">סוכנות נפרדת</option>
          </select>
          <input className={field} name="clientId" placeholder="מזהה לקוח, אם נפרד" autoComplete="off" />
          <input className={field} name="clientSecret" type="password" placeholder="סוד, אם נפרד" autoComplete="off" />
          <button type="submit" className="h-9 rounded-xl bg-primary px-3 text-sm text-primary-foreground">שמירה</button>
          {surenseState.error ? <p className="text-sm text-destructive sm:col-span-2">{surenseState.error}</p> : null}
        </form>
      </Panel>
      <Panel title="ריווחית, גרואו וביטוח">
        <form action={providerAction} className="grid gap-2 sm:grid-cols-2">
          <select className={field} name="provider" defaultValue="rivhit" aria-label="ספק">
            <option value="rivhit">ריווחית</option>
            <option value="grow">גרואו</option>
            <option value="insurance">חברת ביטוח</option>
          </select>
          <input className={field} name="apiUrl" placeholder="כתובת API" />
          <input className={field} name="secret" type="password" placeholder="מפתח" autoComplete="off" />
          <button type="submit" className="h-9 rounded-xl bg-primary px-3 text-sm text-primary-foreground">שמירת מפתח מוצפן</button>
          {providerState.error ? <p className="text-sm text-destructive sm:col-span-2">{providerState.error}</p> : null}
        </form>
      </Panel>
    </div>
  );
}
