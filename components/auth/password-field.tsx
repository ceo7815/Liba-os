"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authFieldClass } from "@/components/auth/auth-styles";
import { cn } from "@/lib/utils";

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
};

export function PasswordField({
  id,
  name,
  label,
  autoComplete = "current-password",
  required = true,
  minLength,
  defaultValue,
}: PasswordFieldProps & { defaultValue?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-extrabold">
        {label}
      </label>
      <div className="relative w-full" dir="ltr">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          className={cn(authFieldClass, "pr-12")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "הסתרת סיסמה" : "הצגת סיסמה"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border-2 border-transparent text-black/55 transition-colors hover:border-highlight hover:bg-highlight/30 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
