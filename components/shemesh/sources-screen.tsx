"use client";

import { Cable } from "lucide-react";
import { useShemeshSources } from "@/components/shemesh/source-context";
import { ShemeshPage } from "@/components/shemesh/widgets";
import { cn } from "@/lib/utils";

export function ShemeshSources() {
  const sources = useShemeshSources();
  const ready = sources.filter((source) => source.connection === "credentials_present").length;

  return (
    <ShemeshPage
      title="מקורות"
      description={`${ready} מחוברים. השאר ייכנסו רק אחרי שתהיה גישה אמיתית, בלי למשוך נתונים של ליבה במקומם.`}
      icon={Cable}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {sources.map((source) => {
          const connected = source.connection === "credentials_present";
          return (
            <article key={source.id} className="app-surface px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">{source.label}</h2>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    connected ? "bg-highlight/15 text-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {connected ? "מחובר" : "ממתין"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{source.pulls}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {connected ? source.lastSyncedAt ?? "מסונכרן" : "עדיין אין חיבור"}
              </p>
            </article>
          );
        })}
      </div>
    </ShemeshPage>
  );
}
