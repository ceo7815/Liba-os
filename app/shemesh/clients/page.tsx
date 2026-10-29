import type { Metadata } from "next";
import Link from "next/link";
import { ShemeshHub } from "@/components/shemesh/hub";
import { Panel } from "@/components/shemesh/widgets";
import { loadHubNumbers } from "@/lib/shemesh/hub-counts";
import { loadDesk, loadCaseBoard } from "@/lib/shemesh/ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "לקוחות ותיקים · שמש" };

export default async function Page() {
  const [numbers, board, ledger] = await Promise.all([
    loadHubNumbers(),
    loadCaseBoard().catch(() => null),
    loadDesk("ledger").catch(() => null),
  ]);
  const names = new Map<string, { cases: number; payments: number }>();
  for (const item of board?.cases ?? []) {
    const row = names.get(item.clientName) ?? { cases: 0, payments: 0 };
    row.cases += 1;
    names.set(item.clientName, row);
  }
  for (const row of ledger?.rows ?? []) {
    const current = names.get(row.title) ?? { cases: 0, payments: 0 };
    current.payments += 1;
    names.set(row.title, current);
  }
  const clients = [...names.entries()].filter(([name]) => name.trim()).sort((a, b) => a[0].localeCompare(b[0], "he"));

  return (
    <div className="space-y-6">
      <ShemeshHub groupId="clients" numbers={numbers} />
      <Panel title="כרטיס לקוח">
        {clients.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">אין עדיין לקוחות בתיקים או בספר.</p>
        ) : (
          <ul className="divide-y divide-white/70 text-sm">
            {clients.map(([name, counts]) => (
              <li key={name}>
                <Link href={`/shemesh/clients/card?name=${encodeURIComponent(name)}`} className="flex items-center justify-between gap-3 py-2 hover:text-[#2f86ea]">
                  <span className="font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">{counts.cases} תיקים · {counts.payments} שורות ספר</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
