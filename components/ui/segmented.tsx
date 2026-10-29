"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Apple-style track. The white pill slides to the button marked `data-selected="true"`. */
export function Segmented({
  value,
  label,
  className,
  children,
}: {
  value: string;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0, w: 0, h: 0, ready: false });

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const active = el.querySelector<HTMLElement>("[data-selected='true']");
      if (!active) return;
      const parent = el.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      setThumb({
        x: box.left - parent.left,
        y: box.top - parent.top,
        w: box.width,
        h: box.height,
        ready: true,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={root} role="tablist" aria-label={label} className={cn("segment", className)}>
      <span
        aria-hidden
        className="segment-thumb"
        style={{
          width: thumb.w,
          height: thumb.h,
          transform: `translate(${thumb.x}px, ${thumb.y}px)`,
          opacity: thumb.ready ? 1 : 0,
        }}
      />
      {children}
    </div>
  );
}
