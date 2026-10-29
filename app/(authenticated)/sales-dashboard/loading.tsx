import { Card } from "@/components/ui/card";

export default function SalesDashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} className="h-36 animate-pulse border-black/[0.06] bg-muted/40 shadow-none" />
        ))}
      </div>
    </div>
  );
}
