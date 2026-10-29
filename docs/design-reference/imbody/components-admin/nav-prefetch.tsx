"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminNav } from "@/lib/admin/nav";

function hrefs() {
  const rows = new Set<string>();
  for (const group of adminNav) {
    if ("href" in group && group.href) rows.add(group.href);
    for (const child of group.children) rows.add(child.href);
  }
  return [...rows];
}

export function NavPrefetch() {
  const router = useRouter();
  useEffect(() => {
    const run = () => {
      for (const href of hrefs()) router.prefetch(href);
    };
    const idle = window.setTimeout(run, 180);
    return () => window.clearTimeout(idle);
  }, [router]);
  return null;
}
