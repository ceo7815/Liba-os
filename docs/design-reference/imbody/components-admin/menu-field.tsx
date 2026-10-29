"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import { Select } from "radix-ui";

export function MenuField({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  name,
  required = false,
  shape = "pill",
}: {
  label?: string;
  ariaLabel?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  shape?: "pill" | "field";
}) {
  const [inner, setInner] = useState(value);
  const [filter, setFilter] = useState("");
  const selected = onChange ? value : inner;
  const current = options.find((option) => option.value === selected) ?? options[0];
  const radius = shape === "field" ? "rounded-xl" : "rounded-full";
  const dir = useLocale() === "he" ? "rtl" : "ltr";
  const shown = filter.trim()
    ? options.filter((option) => option.label.toLowerCase().includes(filter.trim().toLowerCase()))
    : options;

  if (!current) {
    return <div className={`h-10 ${radius} border border-border bg-muted`} />;
  }

  function choose(next: string) {
    if (onChange) onChange(next);
    else setInner(next);
  }

  return (
    <div className={label ? "grid gap-1 text-sm" : "text-sm"}>
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      {name ? <input type="hidden" name={name} value={current.value} required={required} /> : null}
      <Select.Root dir={dir} value={current.value} onValueChange={choose} onOpenChange={(open) => { if (!open) setFilter(""); }}>
        <Select.Trigger
          aria-label={ariaLabel ?? label}
          dir={dir}
          className={`flex h-10 w-full items-center justify-between gap-3 border border-border bg-background px-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring ${radius}`}
        >
          <span className="min-w-0 truncate">{current.label}</span>
          <Select.Icon>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            dir={dir}
            position="popper"
            sideOffset={6}
            className="menu-panel z-50 max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden"
          >
            <Select.Viewport className="max-h-64 overflow-y-auto p-1">
              {options.length > 8 ? (
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="חיפוש"
                  className="mb-1 h-9 w-full rounded-xl border border-border bg-background/80 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              ) : null}
              {shown.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm outline-none focus:bg-accent data-highlighted:bg-accent data-[state=checked]:font-medium"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check className="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
