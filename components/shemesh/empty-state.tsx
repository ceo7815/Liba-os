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
    <div className="flex flex-col items-center rounded-[1.5rem] border border-dashed border-[#185A94]/25 bg-[#f4f7fb] px-6 py-14 text-center">
      <span className="mb-4 inline-flex size-16 items-center justify-center rounded-3xl bg-white shadow-[0_10px_30px_-18px_rgba(24,90,148,0.8)]">
        <Icon className="size-7 text-[#185A94]" />
      </span>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
