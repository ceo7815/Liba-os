"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { inviteUser, type UsersActionState } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initial: UsersActionState = { error: null, success: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="rounded-xl font-semibold">
      {pending ? "שולח הזמנה..." : "שליחת הזמנה"}
    </Button>
  );
}

export function InviteUserDialog() {
  const [state, action] = useFormState(inviteUser, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState("employee");

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="rounded-xl font-semibold">הזמנת עובד</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">הזמנת עובד חדש</DialogTitle>
          <DialogDescription>
            יישלח מייל הזמנה עם קישור להגדרת סיסמה. אין הרשמה עצמית במערכת.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name" className="font-bold">
              שם מלא
            </Label>
            <Input
              id="full_name"
              name="full_name"
              required
              className="h-11 rounded-2xl border-2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="font-bold">
              אימייל
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              dir="ltr"
              className="h-11 rounded-2xl border-2 text-left"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role" className="font-bold">
              תפקיד
            </Label>
            <input type="hidden" name="role" value={role} />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role" className="h-11 rounded-2xl border-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">עובד</SelectItem>
                <SelectItem value="admin">מנהל</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
