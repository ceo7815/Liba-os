"use client";

import { useEffect } from "react";

/** Portaled menus sit outside the shell, so the navy tokens also live on the document. */
export function ShemeshTheme() {
  useEffect(() => {
    document.documentElement.classList.add("shemesh-os");
    return () => document.documentElement.classList.remove("shemesh-os");
  }, []);
  return null;
}
