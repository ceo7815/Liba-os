import { Card } from "@/components/ui/card";

export default function EmployeesLoading() {
  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-4">
      <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
      <Card className="h-16 animate-pulse border-black/[0.06] bg-muted/40 shadow-none" />
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} className="h-14 animate-pulse border-black/[0.06] bg-muted/40 shadow-none" />
        ))}
      </div>
    </div>
  );
}
