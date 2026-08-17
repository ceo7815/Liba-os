export default function AuthenticatedLoading() {
  return (
    <div className="mx-auto max-w-[72rem] space-y-4 animate-pulse">
      <div className="app-surface h-28 bg-background/60" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="app-surface h-40 bg-background/60" />
        <div className="app-surface h-40 bg-background/60" />
      </div>
    </div>
  );
}
