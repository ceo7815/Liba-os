import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Gradient well used on Liba and Shemesh page titles. One component so both systems stay aligned. */
export function IconBadge({
  children,
  tone = "liba",
  className,
}: {
  children: ReactNode;
  tone?: "liba" | "shemesh";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-2xl",
        tone === "shemesh"
          ? "bg-gradient-to-br from-[#d7ecff] to-[#fff4c8] text-[#0b3a66]"
          : "bg-gradient-to-br from-[#ffe7a3] to-white text-[#1a1204]",
        className,
      )}
    >
      {children}
    </span>
  );
}
