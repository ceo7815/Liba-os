"use client";

import { createContext, useContext } from "react";
import { EMPTY_SHEMESH_PULSE, type ShemeshPulse } from "@/lib/shemesh/pulse";

const ShemeshPulseContext = createContext<ShemeshPulse>(EMPTY_SHEMESH_PULSE);

export function ShemeshPulseProvider({
  pulse,
  children,
}: {
  pulse: ShemeshPulse;
  children: React.ReactNode;
}) {
  return <ShemeshPulseContext.Provider value={pulse}>{children}</ShemeshPulseContext.Provider>;
}

export function useShemeshPulse(): ShemeshPulse {
  return useContext(ShemeshPulseContext);
}
