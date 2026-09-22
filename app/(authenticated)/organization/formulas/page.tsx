import type { Metadata } from "next";
import { FormulasScreen } from "@/components/organization/formulas-screen";
import { requireFormulasAccess } from "@/lib/auth";

export const metadata: Metadata = {
  title: "נוסחאות חישוב",
};

export default async function FormulasPage() {
  await requireFormulasAccess();
  return <FormulasScreen />;
}
