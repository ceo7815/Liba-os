"use client";

import { useState } from "react";
import { EmployeesSection } from "@/components/finance/finance-people";
import type { FinanceEmployee } from "@/lib/finance/categories";

export function EmployeesPageClient({
  initialEmployees,
}: {
  initialEmployees: FinanceEmployee[];
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  return <EmployeesSection employees={employees} onChanged={setEmployees} />;
}
