"use client";

import { useState, useTransition } from "react";
import { Copy, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createAgentApiKey,
  revokeAgentApiKey,
  type AgentKeyMeta,
} from "@/app/actions/agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const DEFAULT_KEY_LABEL = "סוכן בקרת שיחות";

type Props = {
  slug: string;
  initialKeys: AgentKeyMeta[];
  defaultLabel?: string;
};

function friendlyKeyLabel(label: string | null, fallback: string) {
  const raw = (label ?? "").trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (lower === "hermes" || lower === "demo-handoff" || lower === "default") {
    return fallback;
  }
  return raw;
}

export function AgentApiKeyPanel({
  slug,
  initialKeys,
  defaultLabel = DEFAULT_KEY_LABEL,
}: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState(defaultLabel);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(true);
  const [pending, startTransition] = useTransition();

  function onCreate() {
    startTransition(async () => {
      const nextLabel = label.trim() || defaultLabel;
      const result = await createAgentApiKey(slug, nextLabel);
      if (result.error || !result.apiKey) {
        toast.error(result.error ?? "יצירת מפתח נכשלה");
        return;
      }
      setFreshKey(result.apiKey);
      setRevealed(true);
      setKeys([
        {
          id: result.keyId,
          label: nextLabel,
          created_at: new Date().toISOString(),
          revoked_at: null,
        },
        ...keys,
      ]);
      toast.success("מפתח נוצר — העתיקו עכשיו; הוא לא יוצג שוב");
    });
  }

  function onRevoke(keyId: string) {
    startTransition(async () => {
      const result = await revokeAgentApiKey(slug, keyId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setKeys(
        keys.map((k) =>
          k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k,
        ),
      );
      toast.success("המפתח בוטל");
    });
  }

  async function copyKey() {
    if (!freshKey) return;
    await navigator.clipboard.writeText(freshKey);
    toast.success("המפתח הועתק");
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">מפתחות API לסוכן בקרת שיחות</h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          מפתח גישה לסוכן בקרת השיחות. המפתח הגולמי מוצג פעם אחת בלבד — העתיקו
          ושמרו במקום מאובטח.
        </p>
      </div>

      {freshKey ? (
        <div className="rounded-2xl border border-highlight/60 bg-highlight/15 p-4">
          <div className="flex items-center gap-2 text-xs font-medium">
            <KeyRound className="h-3.5 w-3.5" />
            מפתח חדש — העתיקו עכשיו
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code
              dir="ltr"
              className="flex-1 break-all rounded-xl bg-white px-3 py-2.5 text-xs"
            >
              {revealed ? freshKey : "•".repeat(40)}
            </code>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => setRevealed((v) => !v)}
              >
                {revealed ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                onClick={copyKey}
              >
                <Copy className="h-3.5 w-3.5" />
                העתקה
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl bg-background px-4 py-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="key-label">תווית</Label>
          <Input
            id="key-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={defaultLabel}
            disabled={pending}
            className="rounded-xl"
          />
        </div>
        <Button
          type="button"
          onClick={onCreate}
          disabled={pending}
          className="rounded-xl sm:shrink-0"
        >
          יצירת מפתח API
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/[0.06]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 bg-background/80 text-xs font-semibold">
                תווית
              </TableHead>
              <TableHead className="h-11 bg-background/80 text-xs font-semibold">
                נוצר
              </TableHead>
              <TableHead className="h-11 bg-background/80 text-xs font-semibold">
                סטטוס
              </TableHead>
              <TableHead className="h-11 w-[7.5rem] bg-background/80 text-xs font-semibold">
                פעולות
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  אין מפתחות עדיין
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => {
                const active = !key.revoked_at;
                return (
                  <TableRow key={key.id} className="hover:bg-black/[0.02]">
                    <TableCell className="py-3.5 font-medium">
                      {friendlyKeyLabel(key.label, defaultLabel)}
                    </TableCell>
                    <TableCell className="py-3.5 text-xs tabular-nums text-muted-foreground">
                      {new Date(key.created_at).toLocaleString("he-IL")}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium",
                          active
                            ? "bg-highlight/35 text-foreground"
                            : "bg-background text-muted-foreground",
                        )}
                      >
                        {active ? "פעיל" : "מבוטל"}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      {active ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 rounded-lg text-red-700 hover:bg-red-50 hover:text-red-800"
                          disabled={pending}
                          onClick={() => onRevoke(key.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          ביטול
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
