"use client";

import { useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { assignCalendarOwner } from "@/lib/crm/dispatch-actions";

type Visit = { id: string; title: string; name: string; when: string; owner: string | null; href: string; editable: boolean };
type Lane = { id: string; name: string };

export function DispatchBoard({ visits, lanes, unassigned }: { visits: Visit[]; lanes: Lane[]; unassigned: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const columns = [{ id: "", name: unassigned }, ...lanes];

  function drop(owner: string, event: DragEvent) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (!id) return;
    const form = new FormData();
    form.set("id", id);
    form.set("owner", owner);
    start(async () => {
      await assignCalendarOwner(form);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {columns.map((lane) => (
        <section
          key={lane.id || "none"}
          className="work-sheet min-h-40 px-3 py-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => drop(lane.id, event)}
        >
          <h2 className="text-sm font-semibold">{lane.name}</h2>
          <ul className="mt-2 grid gap-2">
            {visits.filter((visit) => (visit.owner ?? "") === lane.id).map((visit) => (
              <li
                key={visit.id}
                draggable={visit.editable}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", visit.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                className="rounded-xl bg-muted px-3 py-2 text-sm"
              >
                <a href={visit.href} className="font-medium">{visit.title}</a>
                <p className="text-xs text-muted-foreground">{visit.name} · <bdi dir="ltr">{visit.when}</bdi></p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
