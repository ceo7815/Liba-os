"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  KeyRound,
  Shield,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  saveUserPermissions,
  setUserActive,
  updateUserRole,
  type ManagedUser,
} from "@/app/actions/users";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";
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
  PERMISSION_CATEGORIES,
  PERMISSION_KEYS,
  PERMISSION_PRESETS,
  countGrantedInCategory,
  matchPreset,
  type PermissionKey,
  type PermissionPresetId,
} from "@/lib/permissions/catalog";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export function UsersAccessScreen({
  users: initialUsers,
  currentUserId,
}: {
  users: ManagedUser[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialUsers[0]?.id ?? null,
  );
  const selected = users.find((u) => u.id === selectedId) ?? null;

  return (
    <section className="mx-auto max-w-[88rem] space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">ארגון</p>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/35">
              <Shield className="size-5" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              ניהול משתמשים והרשאות
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            הזמנת משתמשים ומטריצת גישה לכל קטגוריה במערכת — מה כל אחד רואה
            בסיידבר ובמסכים.
          </p>
        </div>
        <InviteUserDialog
          onInvited={() => {
            /* page revalidates; soft refresh via reload */
            window.location.reload();
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <aside className="app-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground">
              {users.length} משתמשים
            </p>
            <Users className="size-4 text-muted-foreground" />
          </div>
          <ul className="max-h-[70vh] overflow-y-auto p-2">
            {users.map((user) => {
              const active = user.id === selectedId;
              const granted = user.permissionKeys.length;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(user.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                      active
                        ? "bg-highlight/30 text-foreground"
                        : "hover:bg-background/80",
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-highlight text-[10px] font-bold text-black">
                      {getInitials(user.full_name || user.email)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {user.full_name || "ללא שם"}
                        </span>
                        {user.id === currentUserId ? (
                          <span className="rounded bg-black/[0.05] px-1 text-[10px] text-muted-foreground">
                            אתה
                          </span>
                        ) : null}
                      </span>
                      <span
                        dir="ltr"
                        className="mt-0.5 block truncate text-xs text-muted-foreground"
                      >
                        {user.email}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <Badge
                          className={cn(
                            "rounded-full border-0 px-2 py-0 text-[10px] font-medium",
                            user.is_active
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-black/[0.06] text-muted-foreground",
                          )}
                        >
                          {user.is_active ? "פעיל" : "מושבת"}
                        </Badge>
                        <Badge className="rounded-full border-0 bg-black/[0.05] px-2 py-0 text-[10px] font-medium text-muted-foreground">
                          {granted}/{PERMISSION_KEYS.length} הרשאות
                        </Badge>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="min-w-0">
          {selected ? (
            <UserPermissionEditor
              user={selected}
              isSelf={selected.id === currentUserId}
              onUserPatched={(next) => {
                setUsers((list) =>
                  list.map((u) => (u.id === next.id ? next : u)),
                );
              }}
            />
          ) : (
            <div className="app-surface flex min-h-[24rem] items-center justify-center px-6 text-sm text-muted-foreground">
              בחרו משתמש כדי לנהל הרשאות
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function UserPermissionEditor({
  user,
  isSelf,
  onUserPatched,
}: {
  user: ManagedUser;
  isSelf: boolean;
  onUserPatched: (user: ManagedUser) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Set<PermissionKey>>(
    () => new Set(user.permissionKeys),
  );
  const [preset, setPreset] = useState<PermissionPresetId>(() =>
    matchPreset(user.permissionKeys),
  );
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PERMISSION_CATEGORIES.map((c) => [c.id, true])),
  );

  useEffect(() => {
    setDraft(new Set(user.permissionKeys));
    setPreset(matchPreset(user.permissionKeys));
  }, [user.id, user.permissionKeys.join("|")]);

  const dirty = useMemo(() => {
    if (draft.size !== user.permissionKeys.length) return true;
    return user.permissionKeys.some((k) => !draft.has(k));
  }, [draft, user.permissionKeys]);

  function toggleKey(key: PermissionKey) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPreset("custom");
  }

  function applyPreset(id: PermissionPresetId) {
    setPreset(id);
    const found = PERMISSION_PRESETS.find((p) => p.id === id);
    if (!found || id === "custom") return;
    setDraft(new Set(found.keys));
  }

  function toggleCategory(categoryId: string, enable: boolean) {
    const cat = PERMISSION_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return;
    setDraft((prev) => {
      const next = new Set(prev);
      for (const p of cat.permissions) {
        if (enable) next.add(p.key);
        else next.delete(p.key);
      }
      return next;
    });
    setPreset("custom");
  }

  function save() {
    startTransition(async () => {
      const keys = PERMISSION_KEYS.filter((k) => draft.has(k));
      const result = await saveUserPermissions(user.id, keys);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("ההרשאות נשמרו.");
      onUserPatched({ ...user, permissionKeys: keys });
    });
  }

  function onRoleChange(role: string) {
    startTransition(async () => {
      const result = await updateUserRole(user.id, role as UserRole);
      if (result.error) toast.error(result.error);
      else {
        toast.success("התפקיד עודכן.");
        onUserPatched({ ...user, role: role as UserRole });
      }
    });
  }

  function onToggleActive() {
    startTransition(async () => {
      const result = await setUserActive(user.id, !user.is_active);
      if (result.error) toast.error(result.error);
      else {
        toast.success(user.is_active ? "המשתמש הושבת." : "המשתמש הופעל.");
        onUserPatched({ ...user, is_active: !user.is_active });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="app-surface px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-highlight text-sm font-bold text-black">
              {getInitials(user.full_name || user.email)}
            </span>
            <div>
              <h2 className="text-lg font-semibold">
                {user.full_name || "ללא שם"}
              </h2>
              <p dir="ltr" className="text-sm text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={user.role}
              onValueChange={onRoleChange}
              disabled={pending}
            >
              <SelectTrigger className="h-9 w-[8rem] rounded-lg bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">עובד</SelectItem>
                <SelectItem value="admin">מנהל</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              disabled={pending || (isSelf && user.is_active)}
              onClick={onToggleActive}
              className="h-9 rounded-lg"
            >
              {user.is_active ? "השבתה" : "הפעלה"}
            </Button>
            <Button
              type="button"
              disabled={pending || !dirty}
              onClick={save}
              className="h-9 rounded-lg font-semibold"
            >
              {pending ? "שומר…" : "שמירת הרשאות"}
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            תבנית הרשאות
          </p>
          <div className="flex flex-wrap gap-2">
            {PERMISSION_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  preset === p.id
                    ? "bg-black text-white"
                    : "bg-background text-muted-foreground hover:text-foreground",
                )}
                title={p.description}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {PERMISSION_CATEGORIES.map((category) => {
          const { granted, total } = countGrantedInCategory(category, draft);
          const open = openCats[category.id] ?? true;
          const allOn = granted === total;
          return (
            <div
              key={category.id}
              className="app-surface overflow-hidden"
            >
              <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-start"
                  onClick={() =>
                    setOpenCats((s) => ({
                      ...s,
                      [category.id]: !open,
                    }))
                  }
                >
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      !open && "-rotate-90",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {category.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {category.description}
                    </span>
                  </span>
                </button>
                <Badge className="rounded-full border-0 bg-black/[0.05] text-[10px] font-medium text-muted-foreground">
                  {granted}/{total}
                </Badge>
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id, !allOn)}
                  className="text-xs font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  {allOn ? "בטל הכל" : "סמן הכל"}
                </button>
              </div>
              {open ? (
                <ul className="divide-y divide-black/[0.04]">
                  {category.permissions.map((perm) => {
                    const on = draft.has(perm.key);
                    return (
                      <li key={perm.key}>
                        <button
                          type="button"
                          onClick={() => toggleKey(perm.key)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-background/60"
                        >
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-md border",
                              on
                                ? "border-emerald-600 bg-emerald-500 text-white"
                                : "border-black/15 bg-white",
                            )}
                          >
                            {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">
                              {perm.label}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {perm.description}
                            </span>
                          </span>
                          <KeyRound className="size-3.5 shrink-0 text-muted-foreground/50" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      {dirty ? (
        <p className="text-center text-xs text-amber-800">
          יש שינויים שלא נשמרו — לחצו «שמירת הרשאות».
        </p>
      ) : null}
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ל";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
