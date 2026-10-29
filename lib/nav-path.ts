import { LEAD_CONTROL_PATH } from "@/lib/lead-control/rules";
import { CAMPAIGNS_PATH } from "@/lib/sales-dashboard/access";

/**
 * Design-lab previews share one URL. Nav highlighting follows the view,
 * which stands in for the real route. Every other path is unchanged.
 */
export function activePath(pathname: string, view: string | null): string {
  if (pathname !== "/design-lab") return pathname;
  if (view === "leads") return LEAD_CONTROL_PATH;
  if (view === "campaigns") return CAMPAIGNS_PATH;
  if (view === "finance" || view === "pl") return "/finance";
  if (view === "shemesh") return "/shemesh";
  return "/dashboard";
}
