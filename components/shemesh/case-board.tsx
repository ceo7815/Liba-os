"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { ClipboardList } from "lucide-react";
import { HebrewDateInput } from "@/components/shemesh/hebrew-date";
import { ShemeshEmpty } from "@/components/shemesh/empty-state";
import { Panel, ShemeshPage } from "@/components/shemesh/widgets";
import { field } from "@/lib/shemesh/field";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CASE_STAGES, SHEMESH_HANDLERS } from "@/lib/shemesh/catalog";
import { SERVICE_TYPES } from "@/lib/shemesh/lifecycle";
import { cn } from "@/lib/utils";
import type { CaseFile } from "@/lib/shemesh/ops";

const idle = { error: null as string | null };

export function CaseBoard({
  cases,
  missing,
  error,
  audit,
  initialOpenId,
  createAction,
  childAction,
  updateAction,
  documentAction,
  canManage,
}: {
  cases: CaseFile[];
  missing: boolean;
  error: string | null;
  audit: { id: string; summary: string; createdAt: string }[];
  initialOpenId?: string | null;
  canManage: boolean;
  createAction: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
  updateAction: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
  childAction: (formData: FormData) => Promise<void>;
  documentAction: (formData: FormData) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [query, setQuery] = useState("");
  const [state, formAction] = useFormState(createAction, idle);
  const selected = cases.find((item) => item.id === openId) ?? null;
  const visible = cases.filter((item) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${item.clientName} ${item.handler} ${item.phone}`.toLowerCase().includes(needle);
  });

  return (
    <ShemeshPage
      title="תיקים"
      description="לוח לפי שלב ורשימה עם תג SLA. לחיצה פותחת את התיק: משימות, מסמכים, הערות ויומן."
      icon={ClipboardList}
    >
      {missing || error ? (
        <ShemeshEmpty
          icon={ClipboardList}
          title={error ? "התיקים לא נקראו" : "טבלת התיקים עדיין לא הורצה"}
          body={error ?? "אחרי אישור המיגרציה אפשר לפתוח תיק, לשייך מטפל ולעקוב אחרי יעד. אין כאן סכום קבוע."}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <a className="inline-flex min-h-11 items-center text-sm font-medium text-highlight" href="/api/shemesh/export?kind=cases">ייצוא לאקסל</a>
          </div>
          {canManage ? <Panel title="תיק חדש">
            <form action={formAction} className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                שם לקוח
                <input className={field} name="clientName" required />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                טלפון
                <input className={field} name="phone" />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                סוג שירות
                <select className={field} name="serviceType" defaultValue="redemption">
                  {SERVICE_TYPES.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="stage" value="lead" />
              <label className="grid gap-1 text-xs text-muted-foreground">
                מטפל
                <select className={field} name="handler" defaultValue="">
                  <option value="">בלי מטפל</option>
                  {SHEMESH_HANDLERS.map((handler) => <option key={handler} value={handler}>{handler}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                נפתח
                <HebrewDateInput name="openedOn" />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                הערה
                <input className={field} name="notes" />
              </label>
              <input type="hidden" name="status" value="open" />
              {state.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
              <Button type="submit" className="sm:col-span-2 sm:w-fit">שמירת תיק</Button>
            </form>
          </Panel> : null}
          <div className="min-w-0">
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [scrollbar-width:none] xl:grid xl:w-full xl:grid-cols-8 xl:overflow-visible [&::-webkit-scrollbar]:hidden">
            {CASE_STAGES.map((stage) => {
              const cards = visible.filter((item) => item.stage === stage.id);
              return (
                <section key={stage.id} className="glass w-[9.5rem] shrink-0 snap-start p-2 xl:w-auto xl:min-w-0">
                  <h2 className="px-1 pb-2 text-xs font-semibold leading-tight">{stage.label}</h2>
                  <div className="space-y-2">
                    {cards.map((item) => (
                      <button key={item.id} type="button" onClick={() => setOpenId(item.id)} className="w-full min-h-11 rounded-xl border border-white/80 bg-white/80 px-2 py-2 text-start shadow-sm transition-[transform,background-color] duration-150 ease-out hover:bg-white active:scale-[0.98]">
                        <span className="block truncate text-sm font-medium">{item.clientName}</span>
                        <SlaBadge overdue={item.overdue} deadline={item.deadline} />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          </div>
          <label className="grid max-w-xs gap-1 text-xs text-muted-foreground">
            חיפוש
            <input className={field} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Panel title={`${visible.length.toLocaleString("he-IL")} תיקים`}>
            <ul className="divide-y divide-border">
              {visible.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setOpenId(item.id)} className="flex w-full items-center justify-between gap-3 py-2 text-start">
                    <span>
                      <span className="block text-sm font-medium">{item.clientName}</span>
                      <span className="block text-xs text-muted-foreground">{item.stageLabel} · {item.handler || "בלי מטפל"}</span>
                    </span>
                    <SlaBadge overdue={item.overdue} deadline={item.deadline} />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          {selected ? (
            <Panel title={selected.clientName}>
              <CaseDetail item={selected} audit={audit} childAction={childAction} updateAction={updateAction} documentAction={documentAction} canManage={canManage} />
            </Panel>
          ) : null}
          <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
            <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md">
              {selected ? (
                <div className="pt-6">
                  <SheetHeader>
                    <SheetTitle>{selected.clientName}</SheetTitle>
                  </SheetHeader>
                  <CaseDetail item={selected} audit={audit} childAction={childAction} updateAction={updateAction} documentAction={documentAction} canManage={canManage} />
                </div>
              ) : null}
            </SheetContent>
          </Sheet>
        </div>
      )}
    </ShemeshPage>
  );
}

const STATUSES = [
  { id: "open", label: "פתוח" },
  { id: "waiting", label: "ממתין" },
  { id: "done", label: "הושלם" },
  { id: "cancelled", label: "בוטל" },
  { id: "on_hold", label: "מושהה" },
];

function CaseDetail({
  item,
  audit,
  childAction,
  updateAction,
  documentAction,
  canManage,
}: {
  item: CaseFile;
  audit: { id: string; summary: string }[];
  childAction: (formData: FormData) => Promise<void>;
  updateAction: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
  documentAction: (formData: FormData) => Promise<void>;
  canManage: boolean;
}) {
  const [state, formAction] = useFormState(updateAction, idle);
  const handlers = Array.from(new Set([item.handler, ...SHEMESH_HANDLERS].filter(Boolean)));
  return (
    <div className="space-y-4 text-start" dir="rtl">
      <SlaBadge overdue={item.overdue} deadline={item.deadline} />
      <p className="text-sm text-muted-foreground">{item.stageLabel} · {item.handler || "בלי מטפל"} · {item.phone}</p>
      {item.notes ? <p className="text-sm">{item.notes}</p> : null}
      {canManage ? (
        <form action={formAction} className="grid gap-2">
          <input type="hidden" name="id" value={item.id} />
          <label className="grid gap-1 text-xs text-muted-foreground">
            סטטוס
            <select className={field} name="status" defaultValue={item.status}>
              {STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            שלב
            <select className={field} name="stage" defaultValue={item.stage}>
              {CASE_STAGES.filter((stage, index) => {
                const current = CASE_STAGES.findIndex((itemStage) => itemStage.id === item.stage);
                return index === current || index === current + 1;
              }).map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            סוג שירות
            <select className={field} name="serviceType" defaultValue={item.serviceType || "redemption"}>
              {SERVICE_TYPES.map((service) => <option key={service.id} value={service.id}>{service.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            מטפל
            <select className={field} name="handler" defaultValue={item.handler}>
              <option value="">בלי מטפל</option>
              {handlers.map((handler) => <option key={handler} value={handler}>{handler}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            הערה
            <input className={field} name="notes" defaultValue={item.notes} />
          </label>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" variant="secondary">שמירת תיק</Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">צפייה בלבד. שינוי סטטוס, מטפל ומסמכים דורש shemesh.manage. הייצוא פתוח ל־shemesh.view.</p>
      )}
      <section>
        <h3 className="text-sm font-semibold">משימות</h3>
        {item.tasks.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">אין משימות בתיק</p> : (
          <ul className="mt-1 space-y-1 text-sm">{item.tasks.map((task) => <li key={task.id}>{task.title} · {task.assignee || "בלי מטפל"} · {task.dueOn || "בלי יעד"}</li>)}</ul>
        )}
      </section>
      <section>
        <h3 className="text-sm font-semibold">מסמכים</h3>
        {item.documents.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">אין מסמכים בתיק</p> : (
        <ul className="mt-1 space-y-2 text-sm">
          {item.documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-2">
              <span>{doc.received ? "✓" : "○"} {doc.label}</span>
              {canManage ? (
                <form action={documentAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={doc.id} />
                  <select className={field} name="state" defaultValue={doc.state || (doc.received ? "received" : "missing")} aria-label="מצב מסמך">
                    <option value="missing">חסר</option>
                    <option value="received">התקבל</option>
                    <option value="invalid">לא תקין</option>
                  </select>
                  <button type="submit" className="text-xs font-medium text-highlight">עדכון</button>
                </form>
              ) : <span className="text-xs text-muted-foreground">{doc.state === "invalid" ? "לא תקין" : doc.received ? "התקבל" : "חסר"}</span>}
            </li>
          ))}
        </ul>
        )}
      </section>
      <section>
        <h3 className="text-sm font-semibold">הערות</h3>
        {item.notesList.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">אין הערות בתיק</p> : (
          <ul className="mt-1 space-y-1 text-sm">{item.notesList.map((note) => <li key={note.id}>{note.body} · {note.author}</li>)}</ul>
        )}
      </section>
      <section>
        <h3 className="text-sm font-semibold">יומן</h3>
        {audit.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">אין אירועים ביומן</p> : (
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">{audit.map((entry) => <li key={entry.id}>{entry.summary}</li>)}</ul>
        )}
      </section>
      {canManage ? <form action={childAction} className="grid gap-2">
        <input type="hidden" name="caseId" value={item.id} />
        <select className={field} name="child" defaultValue="task" aria-label="סוג">
          <option value="task">משימה</option>
          <option value="document">מסמך</option>
          <option value="note">הערה</option>
        </select>
        <input className={field} name="title" placeholder="כותרת" />
        <input className={field} name="assignee" placeholder="מטפל" />
        <HebrewDateInput name="dueOn" />
        <input className={field} name="body" placeholder="נוסח הערה" />
        <Button type="submit" variant="secondary">הוספה לתיק</Button>
      </form> : null}
    </div>
  );
}

function SlaBadge({ overdue, deadline }: { overdue: boolean; deadline: string | null }) {
  return (
    <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
      {overdue ? "חריגת SLA" : deadline ? `יעד ${deadline}` : "בלי יעד"}
    </span>
  );
}
