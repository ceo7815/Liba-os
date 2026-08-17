"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { requestPasswordReset, type AuthActionState } from "@/app/actions/auth";
import { authButtonClass, authFieldClass } from "@/components/auth/auth-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={authButtonClass}>
      {pending ? "שולח..." : "שליחת קישור"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useFormState(requestPasswordReset, initial);

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <p className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-2xl border-2 border-highlight bg-highlight/20 px-4 py-3 text-sm font-bold">
          {state.success}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-extrabold">
          אימייל
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          placeholder="name@company.com"
          className={authFieldClass}
        />
      </div>
      <SubmitButton />
      <p className="pt-1 text-center text-sm font-bold">
        <Link href="/login" className="underline-offset-4 hover:underline">
          חזרה להתחברות
        </Link>
      </p>
    </form>
  );
}
