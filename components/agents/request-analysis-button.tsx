"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { uploadCallRecording } from "@/app/actions/agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  activeStatus: string | null;
  hermesOnline?: boolean;
};

function statusLabel(status: string | null, waiting: boolean) {
  if (waiting) return "מנתח עכשיו · הקלטות נוספות בתור";
  switch (status) {
    case "queued":
    case "claimed":
    case "running":
      return "מנתח עכשיו";
    case "success":
      return "הצליח";
    case "failed":
      return "נכשל";
    case "partial":
      return "חלקי";
    case "cancelled":
      return "בוטל";
    default:
      return status ?? "ממתין להעלאה";
  }
}

export function RequestAnalysisButton({
  slug,
  activeStatus,
  hermesOnline = false,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(activeStatus);
  const [waiting, setWaiting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    setLocalStatus(activeStatus);
    if (activeStatus !== "running" && activeStatus !== "claimed") {
      setWaiting(false);
    }
  }, [activeStatus]);

  const busy =
    localStatus === "queued" ||
    localStatus === "claimed" ||
    localStatus === "running";
  const running = localStatus === "running" || localStatus === "claimed";

  function onFileChange(file: File | null) {
    if (!file) {
      setFileName(null);
      return;
    }
    setFileName(file.name);
    if (!displayName.trim()) {
      setDisplayName(file.name.replace(/\.[^.]+$/, "") || file.name);
    }
  }

  function onAnalyze() {
    const input = fileRef.current;
    const file = input?.files?.[0] ?? null;
    if (!file) {
      toast.error("בחרו קובץ הקלטה");
      return;
    }

    startTransition(async () => {
      const body = new FormData();
      body.set("file", file);
      if (displayName.trim()) body.set("display_name", displayName.trim());
      const result = await uploadCallRecording(slug, body);
      if (result.error !== null) {
        toast.error(result.error);
        return;
      }
      setLocalStatus(result.status ?? "running");
      setWaiting(Boolean(result.waiting));
      if (result.waiting) {
        toast.message(result.message);
      } else {
        toast.success(result.message);
      }
      if (!hermesOnline) {
        toast.message(
          "הסוכן לא אונליין — ההקלטה מוכנה, הפעילו את worker של call-qa (--watch).",
        );
      }
      setFileName(null);
      setDisplayName("");
      if (input) input.value = "";
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">ניתוח הקלטה</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          מעלים הקלטה ולוחצים «נתח שיחה» — הניתוח מתחיל מיד. רק אם כבר רץ ניתוח,
          הקלטות נוספות נכנסות לתור וממשיכות אוטומטית אחריו.
        </p>
      </div>

      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
          hermesOnline
            ? "bg-emerald-50 text-emerald-800"
            : "bg-amber-50 text-amber-900",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            hermesOnline ? "bg-emerald-600" : "bg-amber-600",
          )}
        />
        {hermesOnline ? "סוכן אונליין — מוכן לנתח" : "סוכן לא מחובר — יש להפעיל call-qa"}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            קובץ הקלטה
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg,.aac,.flac,.mp4"
            className="block w-full text-sm file:me-3 file:rounded-xl file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          {fileName ? (
            <span className="block truncate text-[11px] text-muted-foreground">
              נבחר: {fileName}
            </span>
          ) : null}
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            שם להצגה (אופציונלי)
          </span>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="לקוח / נושא השיחה"
            className="h-10 rounded-xl text-start"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          onClick={onAnalyze}
          disabled={pending || !fileName}
          className="h-11 min-w-[12rem] rounded-xl font-semibold"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          נתח שיחה
        </Button>
        <div className="min-w-[14rem]">
          <div
            className={cn(
              "flex items-center gap-2 text-[11px] font-medium",
              busy ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {busy ? (
              <span
                className={cn(
                  "status-live-dot",
                  running ? "status-live-dot--amber" : "",
                )}
                aria-hidden
              />
            ) : null}
            <span>סטטוס: {statusLabel(localStatus, waiting)}</span>
          </div>
          {running ? (
            <div className="status-run-track mt-2" aria-hidden>
              <span className="status-run-bar" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
