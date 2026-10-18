import type { Metadata } from "next";
import { SystemGate } from "@/components/auth/system-gate";
import { createClient } from "@/lib/supabase/server";

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
