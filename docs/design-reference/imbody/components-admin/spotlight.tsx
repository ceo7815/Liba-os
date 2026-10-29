"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

export function Spotlight({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`spotlight ${className}`}
      style={style}
      onMouseMove={(event) => {
        const box = ref.current?.getBoundingClientRect();
        if (!box || !ref.current) return;
        ref.current.style.setProperty("--sx", `${event.clientX - box.left}px`);
        ref.current.style.setProperty("--sy", `${event.clientY - box.top}px`);
      }}
    >
      {children}
    </div>
  );
}
