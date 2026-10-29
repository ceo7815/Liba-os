"use client";

import { useEffect } from "react";

export function AmbientPause() {
  useEffect(() => {
    const root = document.querySelector(".admin-app");
    if (!root) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (document.hidden || media.matches) root.setAttribute("data-paused", "true");
      else root.removeAttribute("data-paused");
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    media.addEventListener("change", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", sync);
    };
  }, []);
  return null;
}
