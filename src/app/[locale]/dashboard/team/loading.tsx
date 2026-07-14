import { Users } from "lucide-react"

/** Shown while the Team route segment is resolving (keeps layout from feeling “stuck” on the prior page). */
export default function TeamRouteLoading() {
  return (
    <div className="space-y-6 py-2" aria-busy="true" aria-label="Opening team">
      <div className="flex items-center gap-3 text-slate-500">
        <Users className="h-5 w-5 shrink-0 animate-pulse" aria-hidden />
        <p className="text-sm font-medium">Opening team workspace…</p>
      </div>
      <div className="h-36 animate-pulse rounded-3xl bg-slate-200/70" />
      <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  )
}
