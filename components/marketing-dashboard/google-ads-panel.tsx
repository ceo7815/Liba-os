"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listGoogleAdsAccounts,
  saveGoogleAdsCustomerId,
  syncGoogleAds,
  type GoogleAdsConnection,
} from "@/app/actions/google-ads";
import { Button } from "@/components/ui/button";
import {
  GOOGLE_ADS_CUBE_SOURCE,
  formatIls,
  googleAdsStatusLabel,
  type GoogleAdsMappedLine,
} from "@/lib/sales-dashboard/campaign-math";
import { cn } from "@/lib/utils";

export function GoogleAdsPanel({
  sourceName,
  rangeLabel,
  connection,
  mapped,
  onChanged,
}: {
  sourceName: string;
  rangeLabel: string;
  connection: GoogleAdsConnection;
  mapped: GoogleAdsMappedLine[];
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const isTargetCube = sourceName === GOOGLE_ADS_CUBE_SOURCE;

  function runSync() {
    startTransition(() => {
      void syncGoogleAds().then((result) => {
        if (!result.ok) {
          toast.error(result.error ?? "סנכרון נכשל");
          return;
        }
        if (result.skipped) {
          toast.message("גוגל אדס עדיין לא מחובר");
          return;
        }
        toast.success("הקמפיינים סונכרנו מגוגל לשיחות נכנסות");
        onChanged();
      });
    });
  }

  if (!connection.developerTokenReady || !connection.oauthReady) {
    return (
      <div className="rounded-xl border border-black/[0.06] bg-background p-4 text-sm">
        <p className="font-semibold">גוגל אדס</p>
        <p className="mt-1 text-muted-foreground">
          כל הוצאות גוגל נספרות בקוביה «{GOOGLE_ADS_CUBE_SOURCE}». בשרת חסרים Developer
          Token, Client ID ו-Client Secret.
        </p>
      </div>
    );
  }

  if (!connection.connected) {
    return (
      <div className="rounded-xl border border-black/[0.06] bg-background p-4 text-sm">
        <p className="font-semibold">גוגל אדס</p>
        <p className="mt-1 text-muted-foreground">
          אחרי החיבור, כל קמפייני גוגל (שם + ID + הוצאה) ייכנסו ל«{GOOGLE_ADS_CUBE_SOURCE}».
        </p>
        <a
          href="/api/google-ads/connect"
          className="mt-3 inline-flex h-9 items-center rounded-md bg-black px-3 text-xs font-semibold text-white"
        >
          חבר גוגל אדס
        </a>
      </div>
    );
  }

  if (connection.needsCustomerPick) {
    return <GoogleAdsAccountPicker onChanged={onChanged} />;
  }

  if (!isTargetCube) {
    return (
      <p className="text-sm text-muted-foreground">
        הוצאות גוגל אדס נספרות בקוביה «{GOOGLE_ADS_CUBE_SOURCE}», לא כאן.
      </p>
    );
  }

  const totalCost = mapped.reduce((sum, row) => sum + row.cost, 0);
  const totalClicks = mapped.reduce((sum, row) => sum + row.clicks, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">קמפיינים מגוגל אדס</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            הכל משויך ל«{GOOGLE_ADS_CUBE_SOURCE}» · {rangeLabel}
            {connection.lastSyncedAt
              ? ` · סונכרן ${new Date(connection.lastSyncedAt).toLocaleString("he-IL")}`
              : ""}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={runSync}>
          <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
          סנכרון
        </Button>
      </div>

      {connection.lastError ? (
        <p className="text-xs text-red-700">{connection.lastError}</p>
      ) : null}

      {mapped.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          אין קמפיינים בזיכרון לטווח הזה. לחצו סנכרון אחרי חיבור החשבון.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
                <th className="py-2 text-start font-semibold">שם קמפיין</th>
                <th className="py-2 text-start font-semibold">ID</th>
                <th className="py-2 text-start font-semibold">סטטוס</th>
                <th className="py-2 text-start font-semibold">קליקים</th>
                <th className="py-2 text-start font-semibold">הוצאה</th>
              </tr>
            </thead>
            <tbody>
              {mapped.map((row) => (
                <tr key={row.googleCampaignId} className="border-b border-black/[0.04] last:border-0">
                  <td className="py-2.5 font-medium">{row.googleCampaignName}</td>
                  <td dir="ltr" className="py-2.5 font-mono text-xs tabular-nums">
                    {row.googleCampaignId}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {googleAdsStatusLabel(row.status)}
                  </td>
                  <td dir="ltr" className="py-2.5 tabular-nums">
                    {row.clicks.toLocaleString("he-IL")}
                  </td>
                  <td dir="ltr" className="py-2.5 font-semibold tabular-nums">
                    {formatIls(row.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-black/[0.12] text-sm font-semibold">
                <td className="py-3" colSpan={3}>
                  סה״כ {mapped.length} קמפיינים
                </td>
                <td dir="ltr" className="py-3 tabular-nums">
                  {totalClicks.toLocaleString("he-IL")}
                </td>
                <td dir="ltr" className="py-3 tabular-nums">
                  {formatIls(totalCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export function GoogleAdsAccountPicker({ onChanged }: { onChanged: () => void }) {
  const [accounts, setAccounts] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(() => {
      void listGoogleAdsAccounts().then((result) => {
        if (!result.ok) {
          toast.error(result.error ?? "לא ניתן לטעון חשבונות");
          return;
        }
        setAccounts(result.accounts ?? []);
      });
    });
  }

  return (
    <div className="rounded-xl border border-black/[0.06] bg-background p-4 text-sm">
      <p className="font-semibold">בחירת חשבון גוגל אדס</p>
      <p className="mt-1 text-muted-foreground">יש כמה חשבונות בגישה. בחרו את חשבון ליבה.</p>
      {accounts == null ? (
        <Button type="button" className="mt-3" disabled={pending} onClick={load}>
          טען חשבונות
        </Button>
      ) : accounts.length === 0 ? (
        <p className="mt-3 text-muted-foreground">לא נמצאו חשבונות.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {accounts.map((id) => (
            <li key={id}>
              <button
                type="button"
                disabled={pending}
                className="w-full rounded-lg border border-black/[0.08] px-3 py-2 text-start font-mono text-sm hover:bg-black/[0.03]"
                onClick={() => {
                  startTransition(() => {
                    void saveGoogleAdsCustomerId(id).then((saved) => {
                      if (!saved.ok) {
                        toast.error(saved.error ?? "שגיאה");
                        return;
                      }
                      return syncGoogleAds().then((synced) => {
                        if (!synced.ok) toast.error(synced.error ?? "סנכרון נכשל");
                        else toast.success("החשבון חובר — ההוצאות בשיחות נכנסות");
                        onChanged();
                      });
                    });
                  });
                }}
              >
                {id}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
