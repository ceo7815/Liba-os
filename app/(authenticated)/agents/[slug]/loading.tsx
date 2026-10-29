export default function AgentLoading() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      <div className="h-4 w-40 rounded bg-border" />
      <div className="app-surface h-28 bg-background/60" />
      <div className="app-surface h-64 bg-background/60" />
    </div>
  );
}
