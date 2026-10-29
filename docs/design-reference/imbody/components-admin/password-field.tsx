"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { insetFieldClass } from "@/components/admin/field-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordField({
  name,
  label,
  error,
  autoComplete,
  grouped = false,
}: {
  name: string;
  label: string;
  error?: string;
  autoComplete: string;
  grouped?: boolean;
}) {
  const t = useTranslations("fields");
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className={grouped ? "" : "grid gap-2"}>
      <Label htmlFor={id} className={grouped ? "sr-only" : "text-[0.72rem] tracking-[0.16em] text-foreground/55 uppercase"}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={grouped ? label : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          dir="auto"
          className={grouped ? `${insetFieldClass} pe-12` : "field pe-12"}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          className={`press absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md ${grouped ? "text-white/55 hover:text-white" : "text-muted-foreground hover:text-foreground"}`}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className={grouped ? "px-4 pb-2 text-sm text-destructive" : "text-sm text-destructive"}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
