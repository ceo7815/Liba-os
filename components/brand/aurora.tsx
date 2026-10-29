"use client";

import { cn } from "@/lib/utils";

/** Full-viewport color field. Sits behind the glass, never catches clicks. */
export function Aurora({ tone = "liba" }: { tone?: "liba" | "shemesh" }) {
  return (
    <div className={cn("aurora", tone === "shemesh" && "aurora-shemesh")} aria-hidden>
      <span />
      <span />
      <span />
      <span />
      <span />
      <i className="aurora-grid" />
    </div>
  );
}
