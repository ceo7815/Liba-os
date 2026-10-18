export default function LeadControlLoading() {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">עבודה</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">בקרת לידים</h1>
        <p className="mt-2 text-sm text-muted-foreground">מושך לידים ותהליכים מ־Surense…</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-[1.25rem] bg-black/[0.04]" />
        ))}
      </div>
    </section>
  );
}
