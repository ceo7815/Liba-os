"use client";

import type { LucideIcon } from "lucide-react";
import { ShemeshEmpty } from "@/components/shemesh/empty-state";
import { Panel, ShemeshPage } from "@/components/shemesh/widgets";
import { field } from "@/lib/shemesh/field";

export { field };

export function ModulePage({
  title,
  description,
  icon,
  emptyTitle,
  emptyBody,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
  children: React.ReactNode;
}) {
  return (
    <ShemeshPage title={title} description={description} icon={icon}>
      <ShemeshEmpty icon={icon} title={emptyTitle} body={emptyBody} />
      {children}
    </ShemeshPage>
  );
}

export function UploadCard({
  title,
  hint,
  onText,
}: {
  title: string;
  hint: string;
  onText: (text: string) => void;
}) {
  return (
    <Panel title={title}>
      <p className="pb-2 text-xs text-muted-foreground">{hint}</p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="text-sm"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void file.text().then(onText);
        }}
      />
    </Panel>
  );
}

export function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}
