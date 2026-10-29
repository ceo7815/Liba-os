"use client";

import { useState } from "react";
import { DateField, DateRangeField } from "@/components/ui/date-range-field";

/** Hebrew day control that still posts an ISO value with the form. */
export function HebrewDateInput({
  name,
  defaultValue = "",
  value,
  onChange,
  id,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (iso: string) => void;
  id?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  return (
    <>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <DateField
        id={id}
        value={current}
        onChange={(iso) => {
          if (value === undefined) setInner(iso);
          onChange?.(iso);
        }}
      />
    </>
  );
}

export function HebrewDateRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
}) {
  return <DateRangeField from={from} to={to} onChange={onChange} />;
}
