export default function HistoryLoading() {
  return (
    <div className="min-h-screen bg-bg pb-24 md:pb-0">
      <div className="border-b border-border h-16" />
      <main className="w-full px-6 lg:px-10 py-8 space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-32 bg-elevated border border-border rounded animate-pulse" />
          <div className="h-12 w-72 bg-elevated border border-border rounded animate-pulse" />
        </div>
        <div className="bg-panel border border-border rounded-xl h-32 animate-pulse" />
        <div className="bg-panel border border-border rounded-xl h-20 animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-panel border border-border rounded-md animate-pulse"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
