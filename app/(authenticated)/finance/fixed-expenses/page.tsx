import { redirect } from "next/navigation";
import { EXPENSES_PATH } from "@/lib/finance/access";
import { requireFinanceAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Old URL — redirect into unified expenses hub (fixed tab). */
export default async function FixedExpensesRedirectPage() {
  await requireFinanceAccess();
  redirect(EXPENSES_PATH);
}
