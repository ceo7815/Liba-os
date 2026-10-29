"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, LoaderCircle, MailCheck } from "lucide-react";
import { requestPasswordReset, type AuthState } from "@/app/admin/actions";
import { continueButtonClass, fieldGroupClass, insetFieldClass } from "@/components/admin/field-styles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(requestPasswordReset, {} satisfies AuthState);

  if (state.sent) {
    return (
      <Alert>
        <MailCheck />
        <AlertTitle>{t("forgot.sentTitle")}</AlertTitle>
        <AlertDescription>{t("forgot.sent")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t(`errors.${state.error}`)}</AlertDescription>
        </Alert>
      ) : null}
      <div className={fieldGroupClass}>
        <Label htmlFor="admin-reset-email" className="sr-only">
          {t("fields.email")}
        </Label>
        <Input
          id="admin-reset-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          enterKeyHint="send"
          defaultValue={state.email ?? ""}
          placeholder={t("fields.email")}
          aria-invalid={Boolean(state.fields?.email)}
          className={insetFieldClass}
          dir="auto"
        />
      </div>
      {state.fields?.email ? <p className="text-sm text-destructive">{t(`errors.${state.fields.email}`)}</p> : null}
      <Button type="submit" disabled={pending} className={continueButtonClass}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        {pending ? t("forgot.pending") : t("forgot.submit")}
      </Button>
    </form>
  );
}
