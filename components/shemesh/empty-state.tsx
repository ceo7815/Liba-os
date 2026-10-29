import type { LucideIcon } from "lucide-react";

export function ShemeshEmpty({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass flex flex-col items-center px-6 py-14 text-center">
      <span className="kpi-badge mb-4 !size-14" data-tone="sun">
        <Icon className="size-6" />
      </span>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
