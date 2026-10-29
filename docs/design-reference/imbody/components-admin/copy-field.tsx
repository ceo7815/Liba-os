"use client";

import { useState } from "react";

export function CopyField({
  label,
  value,
  secret = false,
  copy,
  copied,
  reveal,
  hide,
}: {
  label: string;
  value: string;
  secret?: boolean;
  copy: string;
  copied: string;
  reveal: string;
  hide: string;
}) {
  const [shown, setShown] = useState(!secret);
  const [done, setDone] = useState(false);
  const display = secret && !shown ? "•".repeat(Math.min(value.length, 24)) : value;

  return (
    <div className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <code dir="ltr" className="min-w-0 break-all rounded-2xl bg-muted px-3 py-2 text-start">
          {display}
        </code>
        {secret ? (
          <button type="button" onClick={() => setShown((current) => !current)} className="h-9 rounded-full border border-border px-3 text-xs hover:bg-muted">
            {shown ? hide : reveal}
          </button>
        ) : null}
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => undefined);
            setDone(true);
            window.setTimeout(() => setDone(false), 1600);
          }}
          className="h-9 rounded-full border border-border px-3 text-xs hover:bg-muted"
        >
          {done ? copied : copy}
        </button>
      </div>
    </div>
  );
}
