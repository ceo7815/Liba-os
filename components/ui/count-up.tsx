"use client";

import { useEffect, useState } from "react";

/** Animates a number to its real value. The last frame is `text(value)`. */
export function CountUp({
  value,
  text,
  decimals,
}: {
  value: number;
  text: (value: number) => string;
  /** Counts pass 0 so the animation never paints a fraction. Omit for money. */
  decimals?: number;
}) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(value)) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 720);
      const eased = 1 - (1 - t) ** 3;
      const next = from + (value - from) * eased;
      if (t === 1 || decimals == null) {
        setShown(t === 1 ? value : next);
      } else {
        const scale = 10 ** decimals;
        setShown(Math.round(next * scale) / scale);
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [decimals, value]);

  return (
    <span dir="ltr" className="tabular-nums" aria-label={text(value)}>
      {text(shown)}
    </span>
  );
}
