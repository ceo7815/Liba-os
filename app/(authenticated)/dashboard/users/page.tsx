import type { Metadata } from "next";
import { listManagedUsers } from "@/app/actions/users";
import { UsersAccessScreen } from "@/components/users/users-access-screen";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "ניהול משתמשים והרשאות",
};

export default async function UsersPage() {
  const admin = await requireAdmin();
  const { users, error } = await listManagedUsers();

  if (error) {
    throw new Error("טעינת המשתמשים נכשלה.");
  }

  return (
    <UsersAccessScreen users={users} currentUserId={admin.id} />
  );
}
