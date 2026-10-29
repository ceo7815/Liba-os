import Link from "next/link";
import { SHEMESH_IA, type ShemeshGroup } from "@/lib/shemesh/ia";
import { ShemeshPage } from "@/components/shemesh/widgets";
import { LayoutDashboard } from "lucide-react";

export function ShemeshHub({ groupId, numbers }: { groupId: string; numbers: Record<string, string> }) {
  const group = SHEMESH_IA.find((item) => item.id === groupId) as ShemeshGroup;
  return (
    <ShemeshPage title={group.label} description={group.description} icon={LayoutDashboard}>
      <div className="grid gap-3 sm:grid-cols-2">
        {group.items.map((item) => (
          <Link key={item.href} href={item.href} className="app-surface block px-5 py-4 transition-colors hover:bg-accent/10">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">{item.label}</h2>
              {item.stage ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">שלב {item.stage}</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            <p className="mt-3 text-sm font-medium tabular-nums">{numbers[item.href] ?? "—"}</p>
          </Link>
        ))}
      </div>
    </ShemeshPage>
  );
}
