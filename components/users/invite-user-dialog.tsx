"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  PERMISSION_CATEGORIES,
  PERMISSION_KEYS,
  PERMISSION_PRESETS,
  type PermissionKey,
  type PermissionPresetId,
} from "@/lib/permissions/catalog";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const initial: UsersActionState = { error: null, success: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="rounded-xl font-semibold">
      {pending ? "שולח הזמנה..." : "שליחת הזמנה"}
    </Button>
  );
}

export function InviteUserDialog({
  onInvited,
}: {
  onInvited?: () => void;
}) {
  const [state, action] = useFormState(inviteUser, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("employee");
  const [preset, setPreset] = useState<PermissionPresetId>("employee");
  const [draft, setDraft] = useState<Set<PermissionKey>>(
    () => new Set(PERMISSION_PRESETS.find((p) => p.id === "employee")!.keys),
  );

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
      setOpen(false);
      onInvited?.();
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state, onInvited]);

  const keysJson = useMemo(
    () => JSON.stringify(PERMISSION_KEYS.filter((k) => draft.has(k))),
    [draft],
  );

  function applyPreset(id: PermissionPresetId) {
    setPreset(id);
    const found = PERMISSION_PRESETS.find((p) => p.id === id);
    if (!found || id === "custom") return;
    setDraft(new Set(found.keys));
  }

  function toggleKey(key: PermissionKey) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPreset("custom");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl font-semibold">הזמנת משתמש</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            הזמנת משתמש חדש
          </DialogTitle>
          <DialogDescription>
            יישלח מייל הזמנה עם קישור להגדרת סיסמה. בחרו תבנית הרשאות או התאימו
            ידנית.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={action} className="space-y-4">
          <input type="hidden" name="permission_keys" value={keysJson} />
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
              תפקיד מערכת
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

          <div className="space-y-2">
            <Label className="font-bold">תבנית הרשאות</Label>
            <div className="flex flex-wrap gap-2">
              {PERMISSION_PRESETS.filter((p) => p.id !== "custom").map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold",
                    preset === p.id
                      ? "bg-black text-white"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPreset("custom")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  preset === "custom"
                    ? "bg-black text-white"
                    : "bg-background text-muted-foreground",
                )}
              >
                מותאם
              </button>
            </div>
          </div>

          <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-black/[0.08] p-3">
            {PERMISSION_CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                  {cat.label}
                </p>
                <div className="space-y-1">
                  {cat.permissions.map((perm) => {
                    const on = draft.has(perm.key);
                    return (
                      <button
                        key={perm.key}
                        type="button"
                        onClick={() => toggleKey(perm.key)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-background"
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            on
                              ? "border-emerald-600 bg-emerald-500 text-white"
                              : "border-black/15",
                          )}
                        >
                          {on ? (
                            <Check className="size-3" strokeWidth={3} />
                          ) : null}
                        </span>
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
