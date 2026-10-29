"use client";

import { useFormState } from "react-dom";
import { field } from "@/components/shemesh/module-shell";
import { Panel } from "@/components/shemesh/widgets";
import { chooseShemeshGoogleCustomer, connectShemeshSurense, saveGrowForm, saveRivhitForm, testRivhitForm, testShemeshLinkForm } from "@/app/actions/shemesh-connect";
import type { ShemeshLink } from "@/lib/shemesh/connect";

const idle = { error: null as string | null };
const growIdle = { error: null as string | null, webhookToken: "" };
const testIdle = { error: null as string | null, link: "" };

function when(iso: string | null): string {
  if (!iso) return "אין";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ShemeshConnectPanel({
  links,
  googleChoices,
  missing,
}: {
  links: ShemeshLink[];
  googleChoices: string[];
  missing: boolean;
}) {
  const [rivhitState, rivhitAction] = useFormState(saveRivhitForm, idle);
  const [growState, growAction] = useFormState(saveGrowForm, growIdle);
  const [surenseState, surenseAction] = useFormState(connectShemeshSurense, idle);
  const [googleState, googleAction] = useFormState(chooseShemeshGoogleCustomer, idle);
  const [testState, testAction] = useFormState(testShemeshLinkForm, testIdle);
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
            <p className="mt-2 text-sm">{link.detail || "אין פרטים"}</p>
            <p className="mt-1 text-xs text-muted-foreground">סנכרון אחרון: {when(link.syncedAt)}</p>
            <p className="text-xs text-muted-foreground">בדיקה אחרונה: {when(link.checkedAt)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{link.note || "אין סטטוס"}</p>
            <form action={testAction} className="mt-3">
              <input type="hidden" name="link" value={link.id} />
              <button type="submit" className="h-9 rounded-xl bg-muted px-3 text-sm">בדיקה</button>
            </form>
            {testState.link === link.id && testState.error ? <p className="mt-2 text-sm text-destructive">{testState.error}</p> : null}
            {testState.link === link.id && !testState.error ? <p className="mt-2 text-sm text-muted-foreground">הבדיקה הסתיימה בלי שגיאה.</p> : null}
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
        <p className="mt-2 text-xs text-muted-foreground">חשבון המודעות של שמש הוא act_2542541459538449, דרך אפליקציית מטא של ליבה. בגוגל בוחרים את החשבון מהרשימה אחרי ההתחברות. בלי אסימון שמור הבדיקה לא יוצאת החוצה.</p>
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
      <Panel title="ריווחית">
        <ol className="list-decimal space-y-1 pe-4 text-sm text-muted-foreground">
          <li>צריך api_token ומזהה חברה. בסיס הקריאות קבוע: api.rivhit.co.il.</li>
          <li>את המפתח מנפיקים בריווחית אונליין. המודול בתשלום ויש לו מכסה חודשית, לכן קריאה זהה נשמרת במטמון ונשמר מונה.</li>
          <li>אחרי השמירה, בדיקה קוראת ל־Monitor.Get. קריאות הקריאה הן Document.List, Receipt.List, Customer.List ו־Payment.Report. אין קריאה לפני שהשדות נשמרו.</li>
        </ol>
        <form action={rivhitAction} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className={field} name="companyId" placeholder="company_id" autoComplete="off" />
          <input className={field} name="apiToken" type="password" placeholder="api_token" autoComplete="off" />
          <button type="submit" className="h-9 rounded-xl bg-primary px-3 text-sm text-primary-foreground">שמירה מוצפנת</button>
        </form>
        <form action={testRivhitForm} className="mt-2">
          <button type="submit" className="h-9 rounded-xl bg-muted px-3 text-sm">בדיקת חיבור</button>
        </form>
        {rivhitState.error ? <p className="mt-2 text-sm text-destructive">{rivhitState.error}</p> : null}
      </Panel>
      <Panel title="גרואו (משולם)">
        <ol className="list-decimal space-y-1 pe-4 text-sm text-muted-foreground">
          <li>צריך userId ו־pageCode. apiKey רשות, רק למצב פלטפורמה.</li>
          <li>את הפרטים מנפיק התמיכה של Grow. אין מסך self-serve.</li>
          <li>סנדבוקס: sandbox.meshulam.co.il. ייצור: secure.meshulam.co.il. הוובהוק מחזיר 200 וקורא ל־ApproveTransaction.</li>
        </ol>
        <form action={growAction} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className={field} name="userId" placeholder="userId" autoComplete="off" />
          <input className={field} name="pageCode" type="password" placeholder="pageCode" autoComplete="off" />
          <input className={field} name="apiKey" type="password" placeholder="apiKey, רשות" autoComplete="off" />
          <select className={field} name="environment" defaultValue="sandbox" aria-label="סביבה">
            <option value="sandbox">סנדבוקס</option>
            <option value="production">ייצור</option>
          </select>
          <button type="submit" className="h-9 rounded-xl bg-primary px-3 text-sm text-primary-foreground">שמירה מוצפנת</button>
        </form>
        {growState.webhookToken ? <p className="mt-2 text-xs text-muted-foreground">וובהוק: /api/shemesh/grow/webhook/{growState.webhookToken}</p> : null}
        <form action={testAction} className="mt-2">
          <input type="hidden" name="link" value="shemesh-grow" />
          <button type="submit" className="h-9 rounded-xl bg-muted px-3 text-sm">בדיקת חיבור</button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">בלי userId ו־pageCode אין קריאה. גם אחרי השמירה, אישור עסקה יוצא רק מוובהוק עם מזהה עסקה.</p>
        {growState.error ? <p className="mt-2 text-sm text-destructive">{growState.error}</p> : null}
      </Panel>
      <Panel title="חברות ביטוח">
        <p className="text-sm text-muted-foreground">אין להן API ציבורי. הייבוא הוא קובץ אקסל או מסלקה (Swiftness) לכל חברה, עם מיפוי עמודות שנשמר. העמלות שייכות לליבה, בעלת הרישיון.</p>
        <a className="mt-3 inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm text-primary-foreground" href="/shemesh/insurance">לייבוא ביטוח</a>
      </Panel>
    </div>
  );
}
