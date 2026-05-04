export default function CaloriesLoading() {
  return (
    <div className="min-h-screen bg-bg pb-24 md:pb-0">
      <div className="border-b border-border h-16" />
      <main className="w-full px-6 lg:px-10 py-8 space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-32 bg-elevated border border-border rounded animate-pulse" />
          <div className="h-12 w-72 bg-elevated border border-border rounded animate-pulse" />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="h-72 bg-panel border border-border rounded-xl animate-pulse" />
          <div className="h-72 bg-panel border border-border rounded-xl animate-pulse" />
        </div>
        <div className="h-44 bg-panel border border-border rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-panel border border-border rounded-xl animate-pulse"
            />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-72 bg-panel border border-border rounded-xl animate-pulse"
          />
        ))}
      </main>
    </div>
  );
}
