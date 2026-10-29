"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

/** Hides the browser's English file control. */
export function HebrewFileDrop({
  name,
  accept,
  required,
  hint,
}: {
  name: string;
  accept: string;
  required?: boolean;
  hint: string;
}) {
  const [fileName, setFileName] = useState("");
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#2f86ea]/40 bg-white/80 px-4 py-6 text-center transition-colors hover:bg-white">
      <Upload className="size-5 text-[#2f86ea]" />
      <span className="text-sm font-semibold">{fileName || "גררו קובץ לכאן או לחצו לבחירה"}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <input
        className="sr-only"
        type="file"
        name={name}
        accept={accept}
        required={required}
        onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
      />
    </label>
  );
}
