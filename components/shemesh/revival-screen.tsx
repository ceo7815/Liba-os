"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Panel } from "@/components/shemesh/widgets";
import { field, ModulePage, UploadCard, parseCsv } from "@/components/shemesh/module-shell";
import { formatShemeshCount } from "@/lib/shemesh/format";

export function RevivalScreen() {
  const [templates, setTemplates] = useState<{ title: string; body: string }[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [queue, setQueue] = useState<{ name: string; phone: string }[]>([]);

  return (
    <ModulePage
      title="החזרת לידים"
      description="תור ותבניות בלבד. וואטסאפ לא מחובר עד אימות Meta, ואין שליחה."
      icon={MessageSquare}
      emptyTitle="הבוט עדיין לא משדר"
      emptyBody="shemesh_revival_queue ו־shemesh_message_templates לא הורצו לייצור. אפשר להכין תבנית ותור במסך. כפתור השליחה נשאר כבוי."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="תבנית">
          <div className="grid gap-2">
            <input className={field} placeholder="שם התבנית" value={title} onChange={(event) => setTitle(event.target.value)} />
            <textarea className="min-h-24 rounded-xl border border-black/10 px-3 py-2 text-sm" placeholder="נוסח ההודעה" value={body} onChange={(event) => setBody(event.target.value)} />
            <button
              type="button"
              className="h-9 rounded-xl bg-primary text-sm text-primary-foreground"
              onClick={() => {
                if (!title.trim() || !body.trim()) return;
                setTemplates((current) => [...current, { title: title.trim(), body: body.trim() }]);
                setTitle("");
                setBody("");
              }}
            >
              שמירה במסך
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {templates.map((item) => (
              <li key={item.title}>
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="תור">
          <UploadCard title="אנשי קשר" hint="CSV: שם,טלפון" onText={(text) => setQueue(parseCsv(text).map((row) => ({ name: row[0] || "", phone: row[1] || "" })))} />
          <p className="py-2 text-sm text-muted-foreground">{formatShemeshCount(queue.length)} בתור.</p>
          <button type="button" disabled className="h-9 cursor-not-allowed rounded-xl bg-muted px-3 text-sm text-muted-foreground">
            שליחה לא פעילה עד אימות Meta
          </button>
        </Panel>
      </div>
    </ModulePage>
  );
}
