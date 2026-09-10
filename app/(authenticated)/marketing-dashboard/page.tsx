import { redirect } from "next/navigation";
import { SOURCE_PNL_PATH } from "@/lib/finance/access";

export default function MarketingDashboardRedirectPage() {
  redirect(SOURCE_PNL_PATH);
}
