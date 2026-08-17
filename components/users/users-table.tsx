"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setUserActive, updateUserRole } from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Profile, UserRole } from "@/lib/types";

export function UsersTable({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  return (
    <div className="app-surface overflow-hidden" dir="rtl">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-black/[0.06] hover:bg-transparent">
              <TableHead className="h-11 min-w-[16rem] px-5 text-start text-[11px] font-semibold tracking-wide text-muted-foreground">
                משתמש
              </TableHead>
              <TableHead className="h-11 min-w-[8rem] px-4 text-center text-[11px] font-semibold tracking-wide text-muted-foreground">
                תפקיד
              </TableHead>
              <TableHead className="h-11 min-w-[6.5rem] px-4 text-center text-[11px] font-semibold tracking-wide text-muted-foreground">
                סטטוס
              </TableHead>
              <TableHead className="h-11 min-w-[7rem] px-5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground">
                פעולות
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="px-5 py-12 text-center text-sm text-muted-foreground"
                >
                  אין משתמשים להצגה
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === currentUserId}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function UserRow({ user, isSelf }: { user: Profile; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();

  function onRoleChange(role: string) {
    startTransition(async () => {
      const result = await updateUserRole(user.id, role as UserRole);
      if (result.error) toast.error(result.error);
      else toast.success("התפקיד עודכן.");
    });
  }

  function onToggleActive() {
    startTransition(async () => {
      const result = await setUserActive(user.id, !user.is_active);
      if (result.error) toast.error(result.error);
      else toast.success(user.is_active ? "המשתמש הושבת." : "המשתמש הופעל.");
    });
  }

  return (
    <TableRow className="border-b border-black/[0.04] hover:bg-background/60">
      <TableCell className="px-5 py-3.5 align-middle">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-highlight text-[10px] font-bold text-black">
            {getInitials(user.full_name || user.email)}
          </span>
          <div className="min-w-0 text-start">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="truncate text-sm font-medium text-foreground">
                {user.full_name || "ללא שם"}
              </p>
              {isSelf && (
                <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  אתה
                </span>
              )}
            </div>
            <p
              dir="ltr"
              className="mt-0.5 truncate text-start text-xs text-muted-foreground"
              title={user.email}
            >
              {user.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3.5 align-middle">
        <div className="flex justify-center">
          <Select
            defaultValue={user.role}
            onValueChange={onRoleChange}
            disabled={pending}
          >
            <SelectTrigger className="h-9 w-[7.5rem] rounded-lg border-black/[0.08] bg-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">עובד</SelectItem>
              <SelectItem value="admin">מנהל</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3.5 align-middle">
        <div className="flex justify-center">
          <Badge
            className={
              user.is_active
                ? "rounded-full border-0 bg-highlight/40 px-2.5 py-0.5 font-medium text-foreground hover:bg-highlight/40"
                : "rounded-full border-0 bg-black/[0.06] px-2.5 py-0.5 font-medium text-muted-foreground hover:bg-black/[0.06]"
            }
          >
            {user.is_active ? "פעיל" : "מושבת"}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="px-5 py-3.5 align-middle">
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={pending || (isSelf && user.is_active)}
            onClick={onToggleActive}
            className="h-9 rounded-lg border-black/[0.08] px-3 text-sm font-medium"
          >
            {user.is_active ? "השבתה" : "הפעלה"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ל";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
