import { notFound } from "next/navigation";
import { ControlCenterScreen } from "@/components/dashboard/control-center-screen";
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

/** Local visual preview of the shell. Production builds return 404. */
export default function DesignLabPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <AppShell profile={previewProfile}>
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
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            ["הפקות", "—", "החודש"],
            ["פרמיה", "—", "פעיל"],
            ["ממתינות", "0", "צינור"],
            ["ביטולים", "0", "החודש"],
          ].map(([label, value, hint], index) => (
            <div
              key={label}
              className="kpi-cube rounded-lg border border-border bg-card p-4 text-start shadow-card"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
              <span className="mt-3 block h-1 w-10 rounded-full bg-module" />
              <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>
        <div className="rise overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">לוח</h2>
            <span className="text-[11px] text-muted-foreground">אין רשומה פתוחה</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2 text-start font-semibold">לקוח</th>
                <th className="px-4 py-2 text-start font-semibold">מוצר</th>
                <th className="px-4 py-2 text-start font-semibold">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                  אין רשומות להצגה
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ControlCenterScreen />
      </section>
    </AppShell>
  );
}
