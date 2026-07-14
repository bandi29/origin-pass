/**
 * Generic instant-feedback skeleton for dashboard route transitions. Rendered by
 * `loading.tsx` Suspense boundaries so navigation swaps to this immediately while
 * the destination server component fetches, instead of blocking on a blank screen.
 */
export function DashboardRouteSkeleton({
  label = "Loading",
}: {
  label?: string
}) {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-label={label}>
      {/* Header */}
      <div className="space-y-3">
        <div className="h-8 w-64 max-w-[60%] rounded-lg bg-slate-200/90" />
        <div className="h-4 w-80 max-w-[75%] rounded bg-slate-100" />
      </div>
      {/* KPI / stat strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-slate-100 bg-slate-50/80" />
        ))}
      </div>
      {/* Primary content block */}
      <div className="h-72 rounded-2xl border border-slate-100 bg-slate-50/80" />
    </div>
  )
}
