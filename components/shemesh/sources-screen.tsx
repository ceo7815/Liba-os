"use client";

import { useState } from "react";
import { Cable } from "lucide-react";
import { useShemeshSources } from "@/components/shemesh/source-context";
import { ShemeshPage } from "@/components/shemesh/widgets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ShemeshSourceStatus } from "@/lib/shemesh/connectors/types";
import { cn } from "@/lib/utils";

export function ShemeshSources({ openId = null }: { openId?: string | null }) {
  const sources = useShemeshSources();
  const [open, setOpen] = useState<string | null>(openId);
  const ready = sources.filter((source) => source.connection === "credentials_present").length;
  const selected = sources.find((source) => source.id === open) ?? null;

  return (
    <ShemeshPage
      title="מקורות"
      description={`${ready} מחוברים. השאר ייכנסו רק אחרי שתהיה גישה אמיתית, בלי למשוך נתונים של ליבה במקומם.`}
      icon={Cable}
    >
      {sources.length === 0 ? (
        <div className="app-surface px-6 py-12 text-center">
          <span className="mx-auto mb-3 block size-2 rounded-full bg-highlight" aria-hidden />
          <p className="text-sm text-muted-foreground">אין מקורות להצגה.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((source) => {
            const connected = source.connection === "credentials_present";
            return (
              <button
                key={source.id}
                type="button"
                onClick={() => setOpen(source.id)}
                className="app-surface px-5 py-4 text-start transition-colors hover:bg-highlight/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold">{source.label}</h2>
                  <span className={cn("status-chip", connected ? "status-chip-ok" : "status-chip-wait")}>
                    {connected ? "מחובר" : "ממתין"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{source.pulls}</p>
                <p className="mt-3 text-xs font-medium text-foreground">אשף חיבור</p>
              </button>
            );
          })}
        </div>
      )}
      <ConnectorWizard source={selected} onOpenChange={(next) => setOpen(next ? selected?.id ?? null : null)} />
    </ShemeshPage>
  );
}

function Step({ n }: { n: string }) {
  return (
    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#e7f2ff] text-[11px] font-semibold text-[#0b5cab]">
      {n}
    </span>
  );
}

function ConnectorWizard({
  source,
  onOpenChange,
}: {
  source: ShemeshSourceStatus | null;
  onOpenChange: (open: boolean) => void;
}) {
  const connected = source?.connection === "credentials_present";
  return (
    <Dialog open={Boolean(source)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-0 border-b border-border px-5 pb-4 pt-5 text-start">
          <p className="text-[11px] font-medium text-muted-foreground">אשף חיבור</p>
          <DialogTitle className="mt-1 text-xl">{source?.label}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed">
            {source?.pulls}
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 px-5 py-4 text-sm">
          <li className="flex items-start gap-3">
            <Step n="1" />
            <span>מה נמשך: {source?.pulls}</span>
          </li>
          <li className="flex items-start gap-3">
            <Step n="2" />
            <span>{connected ? "הגישה קיימת והמקור מסומן מחובר." : "ממתין לגישה. אין כאן שדה מפתח."}</span>
          </li>
          <li className="flex items-start gap-3">
            <Step n="3" />
            <span>{source?.message}</span>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
