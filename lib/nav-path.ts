import { ACADEMY_PATH } from "@/lib/academy/access";
import { EMPLOYEE_PAYROLL_PATH } from "@/lib/employees/access";
import { EXPENSES_PATH, GENERAL_PNL_PATH, INSURANCE_AGREEMENTS_PATH, LEDGER_PATH } from "@/lib/finance/access";
import { INTERFACES_PATH } from "@/lib/interfaces/access";
import { LEAD_CONTROL_PATH } from "@/lib/lead-control/rules";
import { CAMPAIGNS_PATH, SALES_BY_SOURCE_PATH, SALES_EXCEL_REPORT_PATH } from "@/lib/sales-dashboard/access";

/**
 * Design-lab previews share one URL. Nav highlighting follows the view,
 * which stands in for the real route. Every other path is unchanged.
 */
export function activePath(pathname: string, view: string | null): string {
  if (pathname !== "/design-lab") return pathname;
  if (view === "leads") return LEAD_CONTROL_PATH;
  if (view === "campaigns") return CAMPAIGNS_PATH;
  if (view === "funnel") return SALES_BY_SOURCE_PATH;
  if (view === "sales-rows") return SALES_EXCEL_REPORT_PATH;
  if (view === "finance") return LEDGER_PATH;
  if (view === "pl") return GENERAL_PNL_PATH;
  if (view === "expenses") return EXPENSES_PATH;
  if (view === "insurance") return INSURANCE_AGREEMENTS_PATH;
  if (view === "employees") return "/employees";
  if (view === "payroll") return EMPLOYEE_PAYROLL_PATH;
  if (view === "academy") return ACADEMY_PATH;
  if (view === "agents") return "/agents";
  if (view === "users") return "/dashboard/users";
  if (view === "settings") return INTERFACES_PATH;
  if (view === "shemesh") return "/shemesh";
  if (view === "shemesh-leads") return "/shemesh/leads";
  if (view === "shemesh-case" || view === "shemesh-queue") return "/shemesh/sales";
  if (view === "shemesh-revenue") return "/shemesh/revenue";
  if (view === "shemesh-expenses") return "/shemesh/expenses";
  if (view === "shemesh-reports") return "/shemesh/reports";
  if (view === "shemesh-sources") return "/shemesh/sources";
  return "/dashboard";
}
