"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createVaultEntry,
  deleteVaultEntry,
  revealVaultPassword,
  updateVaultEntry,
} from "@/app/actions/vault";
import {
  VAULT_CATEGORIES,
  VAULT_CATEGORY_LABELS,
  getVaultCategoryLabel,
  type VaultCategory,
  type VaultEntryMeta,
} from "@/lib/vault/categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  initialEntries: VaultEntryMeta[];
  isAdmin: boolean;
  initialError?: string | null;
};

type FormState = {
  title: string;
  username: string;
  password: string;
  description: string;
  category: VaultCategory;
  system_type: string;
  login_url: string;
};

const emptyForm: FormState = {
  title: "",
  username: "",
  password: "",
  description: "",
  category: "other",
  system_type: "",
  login_url: "",
};

function formFromEntry(entry: VaultEntryMeta): FormState {
  return {
    title: entry.title,
    username: entry.username ?? "",
    password: "",
    description: entry.description ?? "",
    category: entry.category,
    system_type: entry.system_type ?? "",
    login_url: entry.login_url ?? "",
  };
}

function categoryBadge(entry: VaultEntryMeta) {
  if (entry.category === "other" && entry.system_type) {
    return entry.system_type;
  }
  return getVaultCategoryLabel(entry.category);
}

export function VaultPanel({ initialEntries, isAdmin, initialError }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      if (!q) return true;
      const hay = [
        entry.title,
        entry.username ?? "",
        entry.description ?? "",
        entry.system_type ?? "",
        entry.login_url ?? "",
        getVaultCategoryLabel(entry.category),
        entry.category,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query, category]);

  function refreshList(next: VaultEntryMeta[]) {
    setEntries(next);
  }

  return (
    <div className="space-y-4">
      {initialError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {initialError}
        </div>
      ) : null}

      <div className="app-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם, תיאור, משתמש או קטגוריה…"
              className="h-11 rounded-xl border-black/[0.08] pe-3 ps-10"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 w-full rounded-xl border-black/[0.08] sm:w-48">
                <SelectValue placeholder="קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקטגוריות</SelectItem>
                {VAULT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {VAULT_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin ? (
              <VaultEntryDialog
                mode="create"
                disabled={pending}
                onSaved={(entry) => {
                  refreshList([
                    entry,
                    ...entries.filter((e) => e.id !== entry.id),
                  ]);
                  router.refresh();
                }}
              />
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          מוצגות {filtered.length} מתוך {entries.length} רשומות
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="app-surface px-5 py-14 text-center">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-highlight/30">
            <KeyRound className="size-5" />
          </span>
          <p className="mt-4 text-sm font-semibold">
            {entries.length === 0 ? "הכספת ריקה" : "לא נמצאו תוצאות"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            {entries.length === 0
              ? "אדמין יכול להוסיף רשומה ראשונה עם כפתור «הוספת רשומה»."
              : "נסו מילת חיפוש אחרת או החליפו קטגוריה."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((entry) => (
            <VaultCard
              key={entry.id}
              entry={entry}
              isAdmin={isAdmin}
              pending={pending}
              startTransition={startTransition}
              onUpdated={(next) => {
                refreshList(entries.map((e) => (e.id === next.id ? next : e)));
                router.refresh();
              }}
              onDeleted={(id) => {
                refreshList(entries.filter((e) => e.id !== id));
                router.refresh();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VaultCard({
  entry,
  isAdmin,
  pending,
  startTransition,
  onUpdated,
  onDeleted,
}: {
  entry: VaultEntryMeta;
  isAdmin: boolean;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  onUpdated: (entry: VaultEntryMeta) => void;
  onDeleted: (id: string) => void;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onReveal() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    setBusy(true);
    try {
      const result = await revealVaultPassword(entry.id);
      if (result.error || !result.password) {
        toast.error(result.error ?? "פענוח נכשל");
        return;
      }
      setRevealed(result.password);
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    setBusy(true);
    try {
      let password = revealed;
      if (!password) {
        const result = await revealVaultPassword(entry.id);
        if (result.error || !result.password) {
          toast.error(result.error ?? "פענוח נכשל");
          return;
        }
        password = result.password;
      }
      await navigator.clipboard.writeText(password);
      toast.success("הסיסמה הועתקה");
    } finally {
      setBusy(false);
    }
  }

  function onDelete() {
    const ok = window.confirm(`למחוק לצמיתות את «${entry.title}» מהכספת?`);
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteVaultEntry(entry.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("הרשומה נמחקה");
      onDeleted(entry.id);
    });
  }

  return (
    <article className="app-surface overflow-hidden border-2 border-black">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.06] px-4 py-4 sm:px-5">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">
              {entry.title}
            </h3>
            <span className="rounded-md bg-highlight/35 px-2 py-0.5 text-[11px] font-medium">
              {categoryBadge(entry)}
            </span>
          </div>
          {entry.description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {entry.description}
            </p>
          ) : null}
        </div>
        {isAdmin ? (
          <div className="flex shrink-0 items-center gap-1">
            <VaultEntryDialog
              mode="edit"
              entry={entry}
              disabled={pending}
              onSaved={onUpdated}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 rounded-lg text-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={pending}
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
              מחיקה
            </Button>
          </div>
        ) : null}
      </div>

      {/* Details grid */}
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
        <InfoCell
          icon={<UserRound className="size-3.5" />}
          label="משתמש / אימייל"
          value={
            entry.username ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  dir="ltr"
                  className="min-w-0 flex-1 truncate font-medium tabular-nums"
                >
                  {entry.username}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 rounded-lg"
                  title="העתק משתמש"
                  aria-label="העתק משתמש"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(entry.username!);
                      toast.success("המשתמש הועתק");
                    } catch {
                      toast.error("ההעתקה נכשלה");
                    }
                  }}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
        />
        <InfoCell
          icon={<KeyRound className="size-3.5" />}
          label="קטגוריה"
          value={getVaultCategoryLabel(entry.category)}
        />
        <InfoCell
          icon={<ExternalLink className="size-3.5" />}
          label="קישור כניסה"
          className="sm:col-span-2 lg:col-span-1"
          value={
            entry.login_url ? (
              <a
                href={entry.login_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 truncate font-medium underline-offset-2 hover:underline"
                dir="ltr"
              >
                <span className="truncate">{entry.login_url}</span>
                <ExternalLink className="size-3 shrink-0 opacity-60" />
              </a>
            ) : (
              <span className="text-muted-foreground">אין קישור</span>
            )
          }
        />
      </div>

      {/* Password zone */}
      <div className="border-t border-black/[0.06] bg-background/70 px-4 py-3 sm:px-5">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
          סיסמה
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2.5">
            <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
            <code
              className="min-w-0 flex-1 truncate text-sm tabular-nums tracking-wide"
              dir="ltr"
            >
              {revealed ?? "••••••••••••"}
            </code>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 flex-1 rounded-xl gap-1.5 sm:flex-none"
              disabled={busy}
              onClick={onReveal}
            >
              {revealed ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
              {revealed ? "הסתר" : "הצג"}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-10 flex-1 rounded-xl gap-1.5 sm:flex-none"
              disabled={busy}
              onClick={onCopy}
            >
              <Copy className="size-3.5" />
              העתק
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoCell({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-black/[0.05] bg-background/50 px-3 py-2.5 ${className ?? ""}`}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function VaultEntryDialog({
  mode,
  entry,
  disabled,
  onSaved,
}: {
  mode: "create" | "edit";
  entry?: VaultEntryMeta;
  disabled?: boolean;
  onSaved: (entry: VaultEntryMeta) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() =>
    entry ? formFromEntry(entry) : emptyForm,
  );

  function resetForOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setForm(entry ? formFromEntry(entry) : emptyForm);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (mode === "create") {
        const result = await createVaultEntry({
          title: form.title,
          username: form.username,
          password: form.password,
          description: form.description,
          category: form.category,
          system_type: form.system_type,
          login_url: form.login_url,
        });
        if (result.error !== null) {
          toast.error(result.error);
          return;
        }
        if (!result.id) {
          toast.error("שמירה נכשלה");
          return;
        }
        toast.success("הרשומה נוספה לכספת");
        onSaved({
          id: result.id,
          title: form.title.trim(),
          username: form.username.trim() || null,
          description: form.description.trim() || null,
          category: form.category,
          system_type:
            form.category === "other" ? form.system_type.trim() || null : null,
          login_url: form.login_url.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          has_password: true,
        });
        setOpen(false);
        return;
      }

      const result = await updateVaultEntry({
        id: entry!.id,
        title: form.title,
        username: form.username,
        password: form.password || undefined,
        description: form.description,
        category: form.category,
        system_type: form.system_type,
        login_url: form.login_url,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("הרשומה עודכנה");
      onSaved({
        ...entry!,
        title: form.title.trim(),
        username: form.username.trim() || null,
        description: form.description.trim() || null,
        category: form.category,
        system_type:
          form.category === "other" ? form.system_type.trim() || null : null,
        login_url: form.login_url.trim() || null,
        updated_at: new Date().toISOString(),
      });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={resetForOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button
            type="button"
            className="h-11 rounded-xl gap-2 shrink-0"
            disabled={disabled}
          >
            <Plus className="size-4" />
            הוספת רשומה
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 rounded-lg"
            disabled={disabled}
          >
            <Pencil className="size-3.5" />
            עריכה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-md"
        dir="rtl"
      >
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>
            {mode === "create" ? "רשומה חדשה בכספת" : "עריכת רשומה"}
          </DialogTitle>
          <DialogDescription>
            הסיסמה נשמרת מוצפנת. אפשר להוסיף קישור כניסה למערכת בכל קטגוריה.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="vault-title">שם</Label>
            <Input
              id="vault-title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="rounded-xl"
              placeholder="למשל: פורטל מגדל — משתמש משרד"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vault-username">משתמש / אימייל</Label>
            <Input
              id="vault-username"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              className="rounded-xl"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vault-password">
              סיסמה
              {mode === "edit" ? (
                <span className="ms-1 font-normal text-muted-foreground">
                  (השאירו ריק כדי לא לשנות)
                </span>
              ) : null}
            </Label>
            <Input
              id="vault-password"
              type="password"
              required={mode === "create"}
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              className="rounded-xl"
              dir="ltr"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vault-login-url">קישור כניסה למערכת</Label>
            <Input
              id="vault-login-url"
              value={form.login_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, login_url: e.target.value }))
              }
              className="rounded-xl"
              dir="ltr"
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vault-category">קטגוריה</Label>
            <Select
              value={form.category}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, category: v as VaultCategory }))
              }
            >
              <SelectTrigger id="vault-category" className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAULT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {VAULT_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.category === "other" ? (
            <div className="space-y-1.5">
              <Label htmlFor="vault-system-type">מהי המערכת?</Label>
              <Input
                id="vault-system-type"
                required
                value={form.system_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, system_type: e.target.value }))
                }
                className="rounded-xl"
                placeholder="למשל: מערכת Link / CRM / שרת פנימי"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="vault-description">תיאור</Label>
            <Input
              id="vault-description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="rounded-xl"
              placeholder="הערות קצרות לזיהוי"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" className="rounded-xl" disabled={pending}>
              {pending ? "שומר…" : mode === "create" ? "הוספה" : "שמירה"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
            >
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
