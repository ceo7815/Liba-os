import { AppShell } from "@/components/layout/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return <AppShell profile={profile}>{children}</AppShell>;
}
