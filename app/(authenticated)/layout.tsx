import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { requireProfile } from "@/lib/auth";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <>
      <AppShell profile={profile}>{children}</AppShell>
      <Toaster dir="rtl" position="top-center" />
    </>
  );
}
