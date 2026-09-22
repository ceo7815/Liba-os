"use client";

import { useState } from "react";
import { saveAcademyBlock } from "@/app/actions/academy";
import type { AcademyManageLesson } from "@/lib/academy/types";

export function AcademyManageScreen({ lessons }: { lessons: AcademyManageLesson[] }) {
  return (
    <section className="mx-auto w-full max-w-[52rem] space-y-5">
      <header>
        <p className="text-[11px] text-muted-foreground">הדרכה · עריכה</p>
        <h1 className="mt-1 text-2xl font-semibold">ניהול תוכן</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          עורכים בלוקים קיימים. אל תכתוב הגדרות ביטוח שלא אושרו.
        </p>
      </header>
      <div className="space-y-6">
        {lessons.length === 0 ? (
          <p className="rounded-2xl border border-black/[0.06] bg-white p-5 text-sm text-muted-foreground">
            אין שיעורים לעריכה.
          </p>
        ) : null}
        {lessons.map((item) => (
          <article
            key={item.lesson.id}
            className="rounded-2xl border border-black/[0.06] bg-white p-4"
          >
            <h2 className="font-semibold">{item.lesson.title}</h2>
            <div className="mt-3 space-y-3">
              {item.blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין בלוקים בשיעור הזה.</p>
              ) : null}
              {item.blocks.map((block) => (
                <BlockEditor
                  key={block.id}
                  blockId={block.id}
                  kind={block.kind}
                  initial={block.body}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BlockEditor({
  blockId,
  kind,
  initial,
}: {
  blockId: string;
  kind: string;
  initial: string;
}) {
  const [body, setBody] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setMessage(null);
    const result = await saveAcademyBlock({ blockId, body });
    setPending(false);
    setMessage(result.ok ? "נשמר" : result.error);
  }

  return (
    <div>
      <p className="mb-1 text-[11px] text-muted-foreground">{kind}</p>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={5}
        className="w-full rounded-xl border border-black/[0.08] px-3 py-2 text-sm leading-relaxed"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending || body.trim() === initial.trim()}
          className="rounded-xl bg-foreground px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? "שומר…" : "שמירה"}
        </button>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
