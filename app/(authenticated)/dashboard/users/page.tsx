import type { Metadata } from "next";
import { UsersTable } from "@/components/users/users-table";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = {
  title: "ניהול משתמשים",
};

export default async function UsersPage() {
  const admin = await requireAdmin();
  const supabase = createClient();

  const { data, error } = await supabase.rpc("admin_list_profiles");

  if (error) {
    throw new Error("טעינת המשתמשים נכשלה.");
  }

  const users = (data ?? []) as Profile[];

  return (
    <section className="mx-auto max-w-[72rem] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ניהול משתמשים</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          צפייה במשתמשים, שינוי תפקיד והשבתה. משתמש מושבת לא יכול להתחבר.
        </p>
      </div>
      <UsersTable users={users} currentUserId={admin.id} />
    </section>
  );
}
