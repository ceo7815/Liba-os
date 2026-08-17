export default function AgentLoading() {
  return (
    <div className="mx-auto max-w-[72rem] space-y-4 animate-pulse">
      <div className="h-4 w-40 rounded bg-black/[0.06]" />
      <div className="app-surface h-28 bg-background/60" />
      <div className="app-surface h-64 bg-background/60" />
    </div>
  );
}
