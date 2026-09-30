"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type AcademyTab = {
  href: string;
  label: string;
  id: "home" | "catalog" | "team" | "manage";
};

function tabActive(pathname: string, id: AcademyTab["id"]): boolean {
  if (id === "home") {
    return (
      pathname === "/academy" ||
      pathname.startsWith("/academy/lessons/") ||
      pathname.startsWith("/academy/exams/")
    );
  }
  if (id === "catalog") {
    return pathname.startsWith("/academy/catalog") || pathname.startsWith("/academy/courses/");
  }
  if (id === "team") return pathname.startsWith("/academy/team");
  return pathname.startsWith("/academy/manage");
}

export function AcademySectionNav({ tabs }: { tabs: AcademyTab[] }) {
  const pathname = usePathname();
  if (tabs.length < 2) return null;

  return (
    <div className="mb-5 flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="הדרכה">
      {tabs.map((tab) => {
        const selected = tabActive(pathname, tab.id);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={selected}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              selected ? "bg-[#1a1a1a] text-white" : "bg-[#f6f5f1] text-muted-foreground hover:bg-white",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
