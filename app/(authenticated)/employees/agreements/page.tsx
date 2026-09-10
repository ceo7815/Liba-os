import { redirect } from "next/navigation";
import { requireEmployeeAgreementsAccess } from "@/lib/auth";

export default async function EmployeeAgreementsPage() {
  await requireEmployeeAgreementsAccess();
  redirect("/employees");
}
