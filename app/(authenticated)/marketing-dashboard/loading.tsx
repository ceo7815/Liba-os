import { Card } from "@/components/ui/card";

export default function MarketingDashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-4">
      <div className="h-8 w-44 animate-pulse rounded-md bg-muted" />
      <Card className="h-24 animate-pulse border-black/[0.06] bg-muted/40 shadow-none" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="h-32 animate-pulse border-black/[0.06] bg-muted/40 shadow-none" />
        ))}
      </div>
    </div>
  );
}
