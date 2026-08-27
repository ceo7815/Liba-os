"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { createSocialReportLink } from "@/app/actions/social-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { daysInMonth, todayJerusalemDateKey } from "@/lib/social-media/calendar-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function monthBounds(year: number, month: number) {
  const today = todayJerusalemDateKey();
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;
  const from = today >= monthStart && today <= monthEnd ? today : monthStart;
  return { from, to: monthEnd };
}

export function SocialReportDialog({ open, onOpenChange, year, month }: Props) {
  const router = useRouter();
  const bounds = monthBounds(year, month);
  const [from, setFrom] = useState(bounds.from);
  const [to, setTo] = useState(bounds.to);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const next = monthBounds(year, month);
    setFrom(next.from);
    setTo(next.to);
  }, [open, year, month]);

  function openReport() {
    if (!from || !to || from > to) {
      toast.error("בחרו טווח תאריכים תקין");
      return;
    }
    onOpenChange(false);
    router.push(
      `/agents/social-media/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
  }

  function copyLink() {
    if (!from || !to || from > to) {
      toast.error("בחרו טווח תאריכים תקין");
      return;
    }
    startTransition(async () => {
      const res = await createSocialReportLink(from, to);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
        toast.success("הקישור הועתק — כל מי שיש לו את הקישור יכול לפתוח מהנייד");
      } catch {
        toast.message(res.url);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>הפק דוח תזמון</DialogTitle>
          <DialogDescription>
            בחרו מתי עד מתי. הדוח מציג תוכן, שעה ותמונות — ואפשר לשלוח קישור
            פתוח לצוות.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="report-from">מתאריך</Label>
            <Input
              id="report-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-to">עד תאריך</Label>
            <Input
              id="report-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start">
          <Button type="button" onClick={openReport} disabled={pending}>
            <FileText className="h-4 w-4" />
            הצג דוח
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={copyLink}
          >
            העתק קישור פתוח
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
