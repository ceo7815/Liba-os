"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { signIn, type AuthState } from "@/app/admin/actions";
import { PasswordField } from "@/components/admin/password-field";
import { continueButtonClass, fieldGroupClass, insetFieldClass } from "@/components/admin/field-styles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  next,
  email,
  banner,
}: {
  next: string;
  email?: string;
  banner?: "linkExpired" | "passwordUpdated";
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(signIn, { email } satisfies AuthState);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {banner === "passwordUpdated" ? (
        <Alert>
          <AlertDescription>{t("login.passwordUpdated")}</AlertDescription>
        </Alert>
      ) : null}
      {banner === "linkExpired" || state.error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t(`errors.${state.error ?? "linkExpired"}`)}</AlertDescription>
        </Alert>
      ) : null}
      <div className={fieldGroupClass}>
        <Label htmlFor="admin-email" className="sr-only">
          {t("fields.email")}
        </Label>
        <Input
          id="admin-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          enterKeyHint="next"
          defaultValue={state.email ?? email ?? ""}
          placeholder={t("fields.email")}
          aria-invalid={Boolean(state.fields?.email)}
          className={insetFieldClass}
          dir="auto"
        />
        {state.fields?.email ? <p className="px-4 pb-2 text-sm text-destructive">{t(`errors.${state.fields.email}`)}</p> : null}
        <div aria-hidden className="mx-4 h-px bg-white/14" />
        <PasswordField
          name="password"
          label={t("fields.password")}
          autoComplete="current-password"
          grouped
          error={state.fields?.password ? t(`errors.${state.fields.password}`) : undefined}
        />
      </div>
      <Button type="submit" disabled={pending} className={continueButtonClass}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        {pending ? t("login.pending") : t("login.submit")}
      </Button>
    </form>
  );
}
