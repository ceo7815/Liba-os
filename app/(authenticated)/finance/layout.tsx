import { OperatingBrandProvider } from "@/components/finance/operating-brand-bar";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OperatingBrandProvider lockedBrand="liba">
      {children}
    </OperatingBrandProvider>
  );
}
