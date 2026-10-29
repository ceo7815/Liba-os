import { notFound } from "next/navigation";
import { ControlCenterScreen } from "@/components/dashboard/control-center-screen";
import { LeadControlScreen } from "@/components/lead-control/screen";
import { AppShell } from "@/components/layout/app-shell";
import { PERMISSION_KEYS } from "@/lib/permissions/catalog";
import type { Profile } from "@/lib/types";

const previewProfile: Profile = {
  id: "design-lab",
  email: "preview@liba.invalid",
  full_name: "מנהל הדגמה",
  role: "admin",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  permissionKeys: [...PERMISSION_KEYS],
};

const emptyLeads = {
  fetchedAt: "2026-10-29T09:00:00.000Z",
  configured: true,
  error: null,
  truncated: false,
  items: [],
};

/** Local visual preview of the shell. Production builds return 404. */
export default function DesignLabPage({
  searchParams,
}: {
  searchParams?: { view?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <AppShell profile={previewProfile}>
      {searchParams?.view === "leads" ? (
        <LeadControlScreen snapshot={emptyLeads} />
      ) : (
      <section className="w-full space-y-4">
        <header className="dash-enter flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">
              ליבה
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">לוח בקרה</h1>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">תצוגת עיצוב</p>
        </header>
        <ControlCenterScreen />
      </section>
      )}
    </AppShell>
  );
}
