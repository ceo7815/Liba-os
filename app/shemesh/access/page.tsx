import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Panel, ShemeshPage } from "@/components/shemesh/widgets";
import { asRows, isMissingRelation, shemeshAdmin } from "@/lib/shemesh/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "יומן גישה · שמש" };

export default async function AccessPage() {
  let missing = false;
  let rows: { id: string; actor: string; action: string; summary: string; createdAt: string }[] = [];
  try {
    const { data, error } = await shemeshAdmin().from("shemesh_audit").select("*").order("created_at", { ascending: false }).limit(80);
    if (error) missing = isMissingRelation(error.message);
    else {
      rows = asRows(data).map((row) => ({
        id: String(row.id),
        actor: String(row.actor ?? ""),
        action: String(row.action ?? ""),
        summary: String(row.summary ?? ""),
        createdAt: String(row.created_at ?? ""),
      }));
    }
  } catch (error) {
    missing = isMissingRelation(error instanceof Error ? error.message : "");
  }
  return (
    <ShemeshPage title="יומן גישה" description="פעולות שנרשמו על תיקים, ייבוא וטיוטות. אין כאן תוכן שהומצא." icon={ScrollText}>
      {missing ? <p className="text-sm text-muted-foreground">יומן הגישה עדיין לא נקרא.</p> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין שורות. פעולה על תיק או ייבוא תופיע כאן.</p>
      ) : (
        <Panel title="אחרונים">
          <ul className="divide-y divide-white/70 text-sm">
            {rows.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span>{row.summary || row.action}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{row.actor} · {row.createdAt.slice(0, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </ShemeshPage>
  );
}
