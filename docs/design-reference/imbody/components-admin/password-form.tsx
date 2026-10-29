"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { updatePassword, type AuthState } from "@/app/admin/actions";
import { PasswordField } from "@/components/admin/password-field";
import { continueButtonClass, fieldGroupClass } from "@/components/admin/field-styles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function PasswordForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updatePassword, {} satisfies AuthState);

  return (
    <form action={action} className="grid gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t(`errors.${state.error}`)}</AlertDescription>
        </Alert>
      ) : null}
      <div className={fieldGroupClass}>
        <PasswordField
          name="password"
          label={t("fields.newPassword")}
          autoComplete="new-password"
          grouped
          error={state.fields?.password ? t(`errors.${state.fields.password}`) : undefined}
        />
        <div aria-hidden className="mx-4 h-px bg-white/14" />
        <PasswordField
          name="confirm"
          label={t("fields.confirmPassword")}
          autoComplete="new-password"
          grouped
          error={state.fields?.confirm ? t(`errors.${state.fields.confirm}`) : undefined}
        />
      </div>
      <Button type="submit" disabled={pending} className={continueButtonClass}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        {pending ? t("setPassword.pending") : t("setPassword.submit")}
      </Button>
    </form>
  );
}
