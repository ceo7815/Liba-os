"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { deleteCall } from "@/app/actions/agents";
import { Button } from "@/components/ui/button";

type Props = {
  slug: string;
  callId: string;
  callTitle: string;
  onDeleted?: () => void;
};

export function DeleteCallButton({
  slug,
  callId,
  callTitle,
  onDeleted,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm(
      `למחוק לגמרי את השיחה «${callTitle}»?\n\nיימחקו גם התמלול והניתוח. אפשר יהיה להריץ מחדש מגוגל דרייב בלי זכר לשיחה הזו.`,
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteCall(slug, callId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("השיחה נמחקה — אפשר להריץ מחדש");
      onDeleted?.();
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-xl gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
      disabled={pending}
      onClick={onClick}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
      מחק שיחה לצמיתות
    </Button>
  );
}
