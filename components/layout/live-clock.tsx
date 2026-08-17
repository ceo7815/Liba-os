"use client";

import { useEffect, useState } from "react";

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) {
    return <div className="hidden h-8 w-36 md:block" />;
  }

  const dateLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);

  const timeLabel = new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return (
    <div className="hidden text-end md:block">
      <p className="text-sm font-medium tabular-nums leading-none text-foreground">
        {timeLabel}
      </p>
      <p className="mt-1 text-[11px] leading-none text-muted-foreground">{dateLabel}</p>
    </div>
  );
}
