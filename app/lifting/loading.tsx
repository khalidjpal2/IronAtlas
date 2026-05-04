export default function LiftingLoading() {
  return (
    <div className="min-h-screen bg-bg pb-24 md:pb-0">
      <div className="border-b border-border h-16" />
      <main className="w-full px-6 lg:px-10 py-8 space-y-8">
        <div className="space-y-2">
          <div className="h-3 w-32 bg-elevated border border-border rounded animate-pulse" />
          <div className="h-12 w-80 bg-elevated border border-border rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-panel border border-border rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="bg-panel border border-border rounded-xl h-[420px] animate-pulse" />
      </main>
    </div>
  );
}
