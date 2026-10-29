import { MenuField } from "@/components/admin/menu-field";
import type { CrmField } from "@/lib/admin/crm-config";
import type { CustomValue } from "@/lib/crm/custom";

const input = "h-10 rounded-full border border-black/10 bg-transparent px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function CrmFieldInput({
  field,
  locale,
  value,
  none,
  fileLater,
}: {
  field: CrmField;
  locale: string;
  value?: CustomValue;
  none: string;
  fileLater: string;
}) {
  const label = locale === "he" ? field.he : field.en;
  const name = `custom.${field.key}`;
  const text = value == null ? field.defaultValue : Array.isArray(value) ? "" : String(value);
  const ltr = ["number", "currency", "date", "datetime", "email", "phone", "url"].includes(field.type);

  if (field.type === "select") {
    return (
      <MenuField
        name={name}
        label={label}
        required={field.required}
        value={text && field.options.includes(text) ? text : field.required ? (field.options[0] ?? "") : "__none"}
        options={[...(field.required ? [] : [{ value: "__none", label: none }]), ...field.options.map((option) => ({ value: option, label: option }))]}
      />
    );
  }

  if (field.type === "multi_select") {
    const picked = Array.isArray(value) ? value : [];
    return (
      <fieldset className="grid gap-1 text-sm">
        <legend className="mb-1 text-muted-foreground">{label}</legend>
        <div className="flex flex-wrap gap-2">
          {field.options.map((option) => (
            <label key={option} className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-black/10 px-3 has-[:checked]:border-primary has-[:checked]:bg-accent">
              <input type="checkbox" name={name} value={option} defaultChecked={picked.includes(option)} className="accent-[var(--primary)]" />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex h-10 items-center gap-2 self-end text-sm">
        <input type="checkbox" name={name} defaultChecked={value === true || (value == null && field.defaultValue === "true")} className="size-4 accent-[var(--primary)]" />
        {label}
      </label>
    );
  }

  if (field.type === "file") {
    return (
      <div className="grid gap-1 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="flex h-10 items-center rounded-full border border-dashed border-black/15 px-3 text-xs text-muted-foreground">{fileLater}</span>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="grid gap-1 text-sm md:col-span-2">
        <span className="text-muted-foreground">{label}</span>
        <textarea name={name} required={field.required} defaultValue={text} rows={3} maxLength={4000} className="min-h-20 rounded-2xl border border-black/10 bg-transparent px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
      </label>
    );
  }

  const type =
    field.type === "number" || field.type === "currency"
      ? "number"
      : field.type === "date"
        ? "date"
        : field.type === "datetime"
          ? "datetime-local"
          : field.type === "email"
            ? "email"
            : field.type === "url"
              ? "url"
              : field.type === "phone"
                ? "tel"
                : "text";

  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={field.required}
        defaultValue={text}
        step={field.type === "currency" ? "0.01" : field.type === "number" ? "any" : undefined}
        maxLength={type === "text" || type === "tel" || type === "email" || type === "url" ? 500 : undefined}
        dir={ltr ? "ltr" : undefined}
        className={`${input} ${ltr ? "text-start" : ""}`}
      />
    </label>
  );
}
