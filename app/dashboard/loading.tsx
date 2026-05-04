export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-bg pb-24 md:pb-0">
      <div className="border-b border-border h-16" />
      <main className="w-full px-6 lg:px-10 py-8 space-y-8">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-elevated border border-border rounded animate-pulse" />
          <div className="h-12 w-72 bg-elevated border border-border rounded animate-pulse" />
        </div>
        <div className="grid lg:grid-cols-[1fr_420px] gap-6">
          <div
            className="bg-panel border border-border rounded-xl animate-pulse"
            style={{ minHeight: "min(85vh, 920px)" }}
          />
          <div className="bg-panel border border-border rounded-xl h-[600px] animate-pulse" />
        </div>
      </main>
    </div>
  );
}
