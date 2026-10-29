import type { Metadata } from "next";
import { SystemGate } from "@/components/auth/system-gate";

export const metadata: Metadata = {
  title: "התחברות",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; pick?: string };
}) {
  let signedIn = false;
  if (searchParams.pick === "1") {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  }

  return (
    <SystemGate
      disabledError={searchParams.error === "disabled"}
      signedIn={signedIn}
    />
  );
}
