import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { listVaultEntries } from "@/app/actions/vault";
import { requireProfile } from "@/lib/auth";
import { VaultPanel } from "@/components/vault/vault-panel";
import { hasVaultEncryptionKey } from "@/lib/vault/crypto";

export const metadata: Metadata = {
  title: "כספת סיסמאות",
};

export default async function VaultPage() {
  const [profile, list] = await Promise.all([
    requireProfile(),
    listVaultEntries(),
  ]);
  const isAdmin = profile.role === "admin";
  const keyConfigured = hasVaultEncryptionKey();

  return (
    <section className="mx-auto max-w-[72rem] space-y-6">
      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">עבודה</p>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/35">
                <KeyRound className="size-5" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight">
                כספת סיסמאות
              </h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              כספת ארגונית משותפת לחשבונות, אתרים, שרתים ופורטלי ביטוח. כל
              העובדים יכולים לחפש ולהעתיק; רק מנהלים מוסיפים, עורכים ומוחקים.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-black/[0.05] bg-background/80 px-4 py-3 text-center">
            <p className="text-2xl font-semibold tabular-nums leading-none">
              {list.entries.length}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">רשומות</p>
          </div>
        </div>
        {!keyConfigured ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            חסר מפתח הצפנה בשרת (`VAULT_ENCRYPTION_KEY`). הוסיפו אותו
            ל־`.env.local` והפעילו מחדש את שרת הפיתוח לפני שמירת סיסמאות.
          </p>
        ) : null}
      </div>

      <VaultPanel
        initialEntries={list.entries}
        isAdmin={isAdmin}
        initialError={list.error}
      />
    </section>
  );
}
