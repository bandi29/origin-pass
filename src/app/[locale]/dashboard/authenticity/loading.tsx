export default function AuthenticityLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-label="Loading authenticity dashboard">
      <div className="h-9 max-w-xs rounded-lg bg-slate-200/90" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-slate-100 bg-slate-50/80" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-slate-100 bg-slate-50/80" />
    </div>
  )
}
