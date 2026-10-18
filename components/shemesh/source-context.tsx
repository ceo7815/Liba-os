"use client";

import { createContext, useContext } from "react";
import type { ShemeshSourceStatus } from "@/lib/shemesh/connectors/types";

const ShemeshSourceContext = createContext<ShemeshSourceStatus[]>([]);

export function ShemeshSourceProvider({
  sources,
  children,
}: {
  sources: ShemeshSourceStatus[];
  children: React.ReactNode;
}) {
  return (
    <ShemeshSourceContext.Provider value={sources}>
      <div className="flex w-full flex-col">{children}</div>
    </ShemeshSourceContext.Provider>
  );
}

export function useShemeshSources() {
  return useContext(ShemeshSourceContext);
}
