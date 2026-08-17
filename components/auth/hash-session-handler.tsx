"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Captures invite/recovery tokens from the URL hash after email redirects. */
export function HashSessionHandler() {
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession();
  }, []);

  return null;
}
