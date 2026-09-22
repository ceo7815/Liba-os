import Link from "next/link";
import type { AcademyStation } from "@/lib/academy/types";
import { cn } from "@/lib/utils";

export function AcademyPath({
  stations,
  currentId,
}: {
  stations: AcademyStation[];
  currentId?: string | null;
}) {
  if (stations.length === 0) return null;
  const currentIndex = currentId
    ? stations.findIndex((station) => station.id === currentId)
    : stations.findIndex((station) => !station.completed);

  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {stations.map((station, index) => {
        const current = index === currentIndex;
        return (
          <li key={station.id}>
            <Link
              href={`/academy/lessons/${station.id}`}
              title={station.title}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] tabular-nums",
                station.completed
                  ? "bg-foreground text-white"
                  : current
                    ? "bg-highlight text-black"
                    : "bg-black/[0.06] text-muted-foreground",
              )}
            >
              {index + 1}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
