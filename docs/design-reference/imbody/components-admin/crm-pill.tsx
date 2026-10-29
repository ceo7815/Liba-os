export type Tone = "info" | "success" | "warning" | "danger" | "neutral" | "teal" | "olive" | "indigo" | "violet" | "pink" | "slate";

const tones: Record<string, Tone> = {
  "temperature:hot": "danger",
  "temperature:warm": "warning",
  "temperature:cold": "info",
  "task:pending": "neutral",
  "task:in_progress": "info",
  "task:completed": "success",
  "task:cancelled": "danger",
  "task:deferred": "warning",
};

export function CrmPill({
  kind,
  value,
  tone,
  children,
}: {
  kind?: "temperature" | "task";
  value?: string;
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span className="crm-pill" data-tone={tone ?? tones[`${kind}:${value}`] ?? "neutral"}>
      {children}
    </span>
  );
}
