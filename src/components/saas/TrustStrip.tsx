import { ShieldCheck } from "lucide-react"

export function TrustStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ds-text-muted">
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
        Secure &amp; verified
      </span>
      <span className="hidden sm:inline" aria-hidden>
        ·
      </span>
      <span>Built for authentic brands</span>
    </div>
  )
}
