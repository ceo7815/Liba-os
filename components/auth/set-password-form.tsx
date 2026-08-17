"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updatePassword, type AuthActionState } from "@/app/actions/auth";
import { PasswordField } from "@/components/auth/password-field";
import { authButtonClass } from "@/components/auth/auth-styles";
import { Button } from "@/components/ui/button";

const initial: AuthActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={authButtonClass}>
      {pending ? "שומר..." : "שמירת סיסמה"}
    </Button>
  );
}

export function SetPasswordForm() {
  const [state, action] = useFormState(updatePassword, initial);

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <p className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive">
          {state.error}
        </p>
      )}
      <PasswordField
        id="password"
        name="password"
        label="סיסמה חדשה"
        autoComplete="new-password"
        minLength={8}
      />
      <PasswordField
        id="confirm"
        name="confirm"
        label="אימות סיסמה"
        autoComplete="new-password"
        minLength={8}
      />
      <SubmitButton />
    </form>
  );
}
