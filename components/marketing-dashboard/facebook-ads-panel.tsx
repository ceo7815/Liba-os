"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listFacebookAccounts,
  mapFacebookAdsCampaign,
  saveFacebookAdAccount,
  syncFacebookAds,
  unmapFacebookAdsCampaign,
  type FacebookAdsConnection,
} from "@/app/actions/facebook-ads";
import { Button } from "@/components/ui/button";
import {
  facebookAdsStatusLabel,
  formatIls,
  inDateRange,
  type FacebookAdsCampaignRow,
  type FacebookAdsDailyStat,
  type DateRange,
} from "@/lib/sales-dashboard/campaign-math";
import {
  filterFacebookCampaignsForBrand,
} from "@/lib/finance/operating-brand";
import { useOperatingBrand } from "@/components/finance/operating-brand-bar";
import { cn } from "@/lib/utils";

const FACEBOOK_MAPPER_COLLAPSED_KEY = "marketing-facebook-mapper-collapsed";

export function FacebookAdsMapper({
  cubeNames,
  range,
  connection,
  campaigns,
  stats,
  onChanged,
}: {
  cubeNames: string[];
  range: DateRange;
  connection: FacebookAdsConnection;
  campaigns: FacebookAdsCampaignRow[];
  stats: FacebookAdsDailyStat[];
  onChanged: () => void;
}) {
  const { brand } = useOperatingBrand();
  const [pending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState(false);
  const visibleCampaigns = filterFacebookCampaignsForBrand(campaigns, brand);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(FACEBOOK_MAPPER_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(FACEBOOK_MAPPER_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function runSync() {
    startTransition(() => {
      void syncFacebookAds().then((result) => {
        if (!result.ok) {
          toast.error(result.error ?? "סנכרון נכשל");
          return;
        }
        if (result.skipped) {
          toast.message("פייסבוק עדיין לא מחובר");
          return;
        }
        toast.success("הקמפיינים סונכרנו מפייסבוק");
        onChanged();
      });
    });
  }

  if (!connection.oauthReady && !connection.connected) {
    return (
      <div className="rounded-xl border border-black/[0.06] bg-background p-4 text-sm">
        <p className="font-semibold">פייסבוק מודעות</p>
        <p className="mt-1 text-muted-foreground">
          בשרת חסרים FACEBOOK_APP_ID ו-FACEBOOK_APP_SECRET. אחרי שמזינים אותם יופיע כפתור
          החיבור.
        </p>
      </div>
    );
  }

  if (!connection.connected) {
    return (
      <div className="rounded-xl border border-black/[0.06] bg-background p-4 text-sm">
        <p className="font-semibold">פייסבוק מודעות</p>
        <p className="mt-1 text-muted-foreground">
          מחברים את חשבון המודעות, ואז משייכים כל קמפיין לקוביה מדויקת.
        </p>
        <a
          href="/api/facebook-ads/connect"
          className="mt-3 inline-flex h-9 items-center rounded-md bg-black px-3 text-xs font-semibold text-white"
        >
          חבר פייסבוק
        </a>
      </div>
    );
  }

  if (connection.needsAccountPick) {
    return <FacebookAdsAccountPicker onChanged={onChanged} />;
  }

  const unmapped = visibleCampaigns.filter((row) => !row.sourceName).length;
  const mapped = visibleCampaigns.length - unmapped;

  return (
    <div className="rounded-xl border border-black/[0.06] bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">שיוך קמפייני פייסבוק לקוביות</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {connection.adAccountName || connection.adAccountId}
            {connection.lastSyncedAt
              ? ` · סונכרן ${new Date(connection.lastSyncedAt).toLocaleString("he-IL")}`
              : ""}
            {visibleCampaigns.length
              ? ` · ${mapped} משויכים${unmapped ? ` · ${unmapped} נותרו` : ""}`
              : ""}
          </p>
          {collapsed ? (
            <p className="mt-1 text-xs text-muted-foreground">
              השיוכים נשמרים אוטומטית. אפשר להמשיך מאוחר יותר.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleCollapsed}
            title={collapsed ? "הרחב טבלת שיוך" : "מזער טבלת שיוך"}
          >
            {collapsed ? (
              <>
                <ChevronDown className="size-3.5" />
                הרחב שיוך
              </>
            ) : (
              <>
                <ChevronUp className="size-3.5" />
                מזער
              </>
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={runSync}>
            <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
            סנכרון פייסבוק
          </Button>
        </div>
      </div>
      {connection.lastError ? (
        <p className="mt-2 text-xs text-red-700">{connection.lastError}</p>
      ) : null}
      {!collapsed && visibleCampaigns.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {campaigns.length === 0
            ? "אין קמפיינים בזיכרון. לחצו סנכרון אחרי החיבור."
            : "אין קמפיינים לפייסבוק לטאב הזה. מה שמשויך למותג אחר מופיע רק שם."}
        </p>
      ) : null}
      {!collapsed && visibleCampaigns.length > 0 ? (
        <div className="mt-3 -mx-1 overflow-x-auto overscroll-x-contain">
          <table className="w-max min-w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-[11px] text-muted-foreground">
                <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">קמפיין פייסבוק</th>
                <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">ID</th>
                <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">סטטוס</th>
                <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">הוצאה בטווח</th>
                <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">קוביה</th>
              </tr>
            </thead>
            <tbody>
              {visibleCampaigns.map((row) => {
                const cost = stats
                  .filter((item) => item.facebookCampaignId === row.facebookCampaignId)
                  .filter((item) => inDateRange(item.day, range))
                  .reduce((sum, item) => sum + item.cost, 0);
                return (
                  <tr key={row.facebookCampaignId} className="border-b border-black/[0.04] last:border-0">
                    <td className="max-w-[12rem] truncate px-2 py-3 font-medium sm:max-w-none sm:whitespace-normal">
                      {row.facebookCampaignName}
                    </td>
                    <td dir="ltr" className="whitespace-nowrap px-2 py-3 font-mono text-xs tabular-nums">
                      {row.facebookCampaignId}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-muted-foreground">
                      {facebookAdsStatusLabel(row.status)}
                    </td>
                    <td dir="ltr" className="whitespace-nowrap px-2 py-3 tabular-nums">
                      {formatIls(cost)}
                    </td>
                    <td className="px-2 py-3">
                      <select
                        className="h-10 min-w-[9.5rem] max-w-[16rem] rounded-xl border border-black/[0.12] bg-white px-2.5 text-xs sm:h-8 sm:rounded-md"
                        disabled={pending}
                        value={row.sourceName ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          startTransition(() => {
                            const run = value
                              ? mapFacebookAdsCampaign({
                                  facebookCampaignId: row.facebookCampaignId,
                                  sourceName: value,
                                })
                              : unmapFacebookAdsCampaign(row.facebookCampaignId);
                            void run.then((saved) => {
                              if (!saved.ok) toast.error(saved.error ?? "שגיאה");
                              else onChanged();
                            });
                          });
                        }}
                      >
                        <option value="">לא משויך</option>
                        {cubeNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function FacebookAdsCubePanel({
  sourceName,
  rangeLabel,
  mapped,
}: {
  sourceName: string;
  rangeLabel: string;
  mapped: { facebookCampaignId: string; facebookCampaignName: string; status: string; cost: number; clicks: number; impressions: number }[];
}) {
  const totalCost = mapped.reduce((sum, row) => sum + row.cost, 0);
  const totalClicks = mapped.reduce((sum, row) => sum + row.clicks, 0);

  if (mapped.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        אין קמפיין פייסבוק משויך ל«{sourceName}». שייכו למעלה בטבלת פייסבוק.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        קמפייני פייסבוק בקוביה הזו · {rangeLabel}
      </p>
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
              <tr key={row.facebookCampaignId} className="border-b border-black/[0.04] last:border-0">
                <td className="py-2.5 font-medium">{row.facebookCampaignName}</td>
                <td dir="ltr" className="py-2.5 font-mono text-xs tabular-nums">
                  {row.facebookCampaignId}
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {facebookAdsStatusLabel(row.status)}
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
    </div>
  );
}

export function FacebookAdsAccountPicker({ onChanged }: { onChanged: () => void }) {
  const [accounts, setAccounts] = useState<{ id: string; name: string }[] | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(() => {
      void listFacebookAccounts().then((result) => {
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
      <p className="font-semibold">בחירת חשבון מודעות</p>
      <p className="mt-1 text-muted-foreground">יש כמה חשבונות בפייסבוק. בחרו את חשבון ליבה.</p>
      {accounts == null ? (
        <Button type="button" className="mt-3" disabled={pending} onClick={load}>
          טען חשבונות
        </Button>
      ) : accounts.length === 0 ? (
        <p className="mt-3 text-muted-foreground">לא נמצאו חשבונות מודעות.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {accounts.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                disabled={pending}
                className="w-full rounded-lg border border-black/[0.08] px-3 py-2 text-start hover:bg-black/[0.03]"
                onClick={() => {
                  startTransition(() => {
                    void saveFacebookAdAccount(account.id, account.name).then((saved) => {
                      if (!saved.ok) {
                        toast.error(saved.error ?? "שגיאה");
                        return;
                      }
                      return syncFacebookAds().then((synced) => {
                        if (!synced.ok) toast.error(synced.error ?? "סנכרון נכשל");
                        else toast.success("חשבון המודעות חובר");
                        onChanged();
                      });
                    });
                  });
                }}
              >
                <span className="block font-medium">{account.name}</span>
                <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                  {account.id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
