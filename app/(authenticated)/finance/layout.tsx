import {
  OperatingBrandBar,
  OperatingBrandProvider,
} from "@/components/finance/operating-brand-bar";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OperatingBrandProvider>
      <div className="mb-4 sm:mb-6">
        <OperatingBrandBar />
      </div>
      {children}
    </OperatingBrandProvider>
  );
}
