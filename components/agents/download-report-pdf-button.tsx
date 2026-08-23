"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  openCallReportPdf,
  type CallReportPdfAnalysis,
} from "@/lib/agents/call-qa-report-pdf";

type Props = {
  customerName: string;
  agentName: string;
  title: string;
  callDate: string;
  duration: string;
  source: string;
  status: string;
  fileName?: string;
  driveUrl?: string | null;
  analysis: CallReportPdfAnalysis | null;
};

export function DownloadReportPdfButton(props: Props) {
  const [pending, setPending] = useState(false);

  function onClick() {
    if (!props.analysis || pending) return;
    setPending(true);
    try {
      // Must stay synchronous with the click so the browser allows the popup.
      const ok = openCallReportPdf({
        ...props,
        logoUrl: `${window.location.origin}/brand/liba-logo.png`,
      });
      if (!ok) {
        toast.error("יש לאפשר חלונות קופצים כדי להוריד את הדוח");
        return;
      }
      toast.message("נפתח חלון הדוח — לחצו «הורדת PDF» או שמרו כ־PDF");
    } finally {
      window.setTimeout(() => setPending(false), 600);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-xl gap-2"
      disabled={pending || !props.analysis}
      onClick={onClick}
      title={props.analysis ? "הורדת הדוח ללא תמלול" : "אין ניתוח להורדה"}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Download className="size-3.5" />
      )}
      הורדת דוח PDF
    </Button>
  );
}
