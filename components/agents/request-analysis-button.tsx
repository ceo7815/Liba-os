"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { requestCallAnalysis } from "@/app/actions/agents";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  activeStatus: string | null;
};

function statusLabel(status: string | null) {
  switch (status) {
    case "queued":
      return "בתור";
    case "claimed":
      return "נמשך ע״י הסוכן";
    case "running":
      return "רץ";
    case "success":
      return "הצליח";
    case "failed":
      return "נכשל";
    case "partial":
      return "חלקי";
    case "cancelled":
      return "בוטל";
    default:
      return status ?? "אין הרצה פעילה";
  }
}

export function RequestAnalysisButton({ slug, activeStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(activeStatus);

  useEffect(() => {
    setLocalStatus(activeStatus);
  }, [activeStatus]);

  const busy =
    localStatus === "queued" ||
    localStatus === "claimed" ||
    localStatus === "running";
  const running = localStatus === "running";

  function onClick() {
    startTransition(async () => {
      const result = await requestCallAnalysis(slug);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setLocalStatus(result.status);
      if (result.alreadyQueued) {
        toast.message(result.message);
      } else {
        toast.success(result.message);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold">ניתוח מתיקיית גוגל דרייב</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          לחיצה כאן רק מוסיפה בקשה לתור. מערכת הסוכנים מושכת מגוגל דרייב ומדווחת
          חזרה — ליבה OS לא מתחברת לדרייב ולא מריצה תמלול.
        </p>
      </div>
      <div className="flex min-w-[12rem] flex-col items-stretch gap-2 sm:items-end">
        <Button
          type="button"
          onClick={onClick}
          disabled={pending}
          className="min-w-[11rem]"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          בצע ניתוח שיחות
        </Button>
        <div className="w-full sm:w-[11rem]">
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
            <span>סטטוס: {statusLabel(localStatus)}</span>
          </div>
          {running ? (
            <div className="status-run-track mt-2" aria-hidden>
              <span className="status-run-bar" />
            </div>
          ) : null}
          {busy && !running ? (
            <div className="status-queue-track mt-2" aria-hidden>
              <span className="status-queue-bar" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
