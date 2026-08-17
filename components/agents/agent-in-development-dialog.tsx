"use client";

import { useEffect, useState } from "react";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  agentName: string;
};

export function AgentInDevelopmentDialog({ agentName }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(true);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-2xl sm:max-w-md" dir="rtl">
        <DialogHeader className="space-y-3 text-right sm:text-right">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-highlight/35">
            <Construction className="size-5" />
          </div>
          <DialogTitle className="text-center text-lg">
            הסוכן בפיתוח
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            «{agentName}» עדיין בבנייה. בקרוב יופיעו כאן פעילות, עלויות ותוצרים
            — בינתיים המסך מוכן ומחכה לחיבור.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => setOpen(false)}
          >
            הבנתי
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
