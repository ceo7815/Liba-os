"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { loadMarketingCampaignsState } from "@/app/actions/marketing-campaigns";
import { listFinanceEmployees, syncEmployeesFromExcel } from "@/app/actions/finance-people";
import { listEmployeeHours } from "@/app/actions/finance-employee-hours";
import { EmployeesSection } from "@/components/finance/finance-people";
import {
  DEFAULT_AGENT_MULTIPLIER,
  type AgentRate,
} from "@/lib/sales-dashboard/campaign-math";
import {
  contractWageTotals,
  toPayProfile,
  withResolvedOneTimePayments,
  parsePayAgreements,
} from "@/lib/employees/contract";
import { collectExcelSellerNames, excelAgentKey } from "@/lib/employees/excel-sellers";
import { groupHoursByEmployeeId, groupVacationDaysByEmployeeId, type EmployeeHoursRow } from "@/lib/employees/hours";
import type { FinanceEmployee } from "@/lib/finance/categories";
import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";
import { GLOBAL_SYNC_EVENT } from "@/components/layout/global-sync-button";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import type { DashboardData, MarketingProduction } from "@/lib/sales-dashboard/types";
import { Button } from "@/components/ui/button";

export function EmployeesPageClient({
  initialEmployees,
}: {
  initialEmployees: FinanceEmployee[];
}) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [employees, setEmployees] = useState(initialEmployees);
  const [rates, setRates] = useState<AgentRate[]>([]);
  const [defaultMultiplier, setDefaultMultiplier] = useState(DEFAULT_AGENT_MULTIPLIER);
  const [productions, setProductions] = useState<MarketingProduction[]>([]);
  const [hours, setHours] = useState<EmployeeHoursRow[]>([]);
  const [wageLoading, setWageLoading] = useState(true);
  const [syncing, startSync] = useTransition();
  const { dashboard: liveDashboard, ready: liveReady } = useLiveDashboard();

  const hoursByEmployee = useMemo(() => groupHoursByEmployeeId(hours), [hours]);
  const vacationByEmployee = useMemo(() => groupVacationDaysByEmployeeId(hours), [hours]);

  const totals = useMemo(
    () =>
      contractWageTotals(productions, {
        profiles: employees.map((row) => {
          const agreements = (
            row.agreements?.length
              ? row.agreements
              : parsePayAgreements(row.pay_contract, row.employment_kind)
          ).map((agreement) => ({
            ...agreement,
            contract: withResolvedOneTimePayments(agreement.contract),
          }));
          return toPayProfile({
            fullName: row.full_name,
            employmentKind: row.employment_kind,
            contract: withResolvedOneTimePayments(
              agreements[0]?.contract ?? row.pay_contract,
            ),
            agreements,
            hoursByMonth: hoursByEmployee.get(row.id),
            vacationDaysByMonth: vacationByEmployee.get(row.id),
          });
        }),
        rates: [],
        fallback: 0,
      }),
    [employees, hoursByEmployee, productions, vacationByEmployee],
  );

  const excelNames = useMemo(
    () => collectExcelSellerNames(dashboard, productions.map((row) => ({ agent: row.agent }))),
    [dashboard, productions],
  );

  const missingExcelNames = useMemo(() => {
    const have = new Set(employees.map((row) => excelAgentKey(row.full_name)));
    return excelNames.filter((name) => !have.has(excelAgentKey(name)));
  }, [employees, excelNames]);

  const sellerHints = useMemo(
    () => excelNames.map((agent) => ({ agent })),
    [excelNames],
  );

  const applyDashboard = useCallback((data: DashboardData) => {
    setDashboard(data);
    setProductions(data.marketing?.productions ?? []);
    setWageLoading(false);
  }, []);

  const importSellers = useCallback(
    (quiet: boolean) => {
      startSync(() => {
        void syncEmployeesFromExcel({ sellers: sellerHints }).then(async (result) => {
          if (result.error) {
            if (!quiet) toast.error(result.error);
            return;
          }
          if (result.added > 0) {
            toast.success(
              `נוספו ${result.added} שמות מהסנכרון האחרון (${result.found} משווקים בדוח)`,
            );
          } else if (!quiet) {
            toast.success(
              result.found > 0
                ? `כל ${result.found} השמות מהסנכרון האחרון כבר ברשימה`
                : "אין סנכרון אקסל שמור — סנכרנו הכל בדוח לפי מקור",
            );
          }
          const list = await listFinanceEmployees();
          if (!list.error) setEmployees(list.employees);
        });
      });
    },
    [sellerHints],
  );

  const loadRates = useCallback(async () => {
    try {
      const state = await loadMarketingCampaignsState();
      setRates(state.rates);
      setDefaultMultiplier(state.defaultMultiplier);
      if (state.error) toast.error(state.error);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "שגיאת טעינת שכר");
    }
  }, []);

  useLayoutEffect(() => {
    if (liveDashboard) applyDashboard(liveDashboard);
    else if (liveReady) setWageLoading(false);
  }, [applyDashboard, liveDashboard, liveReady]);

  const reloadHours = useCallback(async () => {
    const result = await listEmployeeHours();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setHours(result.hours);
  }, []);

  useEffect(() => {
    void listFinanceEmployees().then((list) => {
      if (!list.error) setEmployees(list.employees);
    });
  }, []);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  useEffect(() => {
    void reloadHours();
  }, [reloadHours]);

  useEffect(() => {
    const onGlobalSync = () => {
      void listFinanceEmployees().then((list) => {
        if (!list.error) setEmployees(list.employees);
      });
      void reloadHours();
      void loadRates();
    };
    window.addEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
    return () => window.removeEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
  }, [loadRates, reloadHours]);

  const syncedAtLabel = formatLastUpdatedAt(dashboard?.syncedAt);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 rounded-[1.25rem] border border-black/[0.06] bg-white px-4 py-3 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:flex-row sm:items-center sm:justify-between sm:rounded-[var(--radius)] sm:px-5">
        <p className="min-w-0 text-sm leading-snug text-muted-foreground">
          {wageLoading
            ? "טוען שכר מהסנכרון האחרון…"
            : dashboard?.source === "live"
              ? `${excelNames.length} משווקים בסנכרון · ${employees.length} כרטיסים${syncedAtLabel ? ` · ${syncedAtLabel}` : ""}`
              : `${employees.length} כרטיסים · אין סנכרון אקסל שמור`}
          {missingExcelNames.length > 0 ? (
            <span className="font-medium text-amber-800">
              {" "}
              · חסרים {missingExcelNames.length}
            </span>
          ) : null}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 rounded-xl border-black/[0.08] active:scale-95"
          disabled={syncing}
          onClick={() => importSellers(false)}
        >
          {syncing ? "מעדכן…" : "עדכון שמות מהסנכרון"}
        </Button>
      </div>
      <EmployeesSection
        employees={employees}
        onChanged={setEmployees}
        rates={rates}
        defaultMultiplier={defaultMultiplier}
        wageTotals={totals}
        wageLoading={wageLoading}
        productions={productions}
        hours={hours}
        onHoursChanged={() => void reloadHours()}
        onRatesChanged={() => {
          void loadRates();
        }}
      />
    </div>
  );
}
