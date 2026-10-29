"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { shemeshCrumbs } from "@/lib/shemesh/ia";

export function ShemeshBreadcrumbs() {
  const pathname = usePathname();
  const crumbs = shemeshCrumbs(pathname);
  if (crumbs.length < 2) return null;
  return (
    <nav aria-label="מיקום" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground print:hidden">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <span key={crumb.href} className="inline-flex items-center gap-1">
            {index > 0 ? <span aria-hidden>‹</span> : null}
            {last ? <span className="font-medium text-foreground">{crumb.label}</span> : <Link href={crumb.href} className="hover:text-foreground">{crumb.label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}
