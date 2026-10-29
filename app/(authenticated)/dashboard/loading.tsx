import { Card } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-3">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <Card className="h-40 animate-pulse border-black/[0.06] bg-muted/40 shadow-none" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="h-28 animate-pulse border-black/[0.06] bg-muted/40 shadow-none" />
        ))}
      </div>
    </div>
  );
}
