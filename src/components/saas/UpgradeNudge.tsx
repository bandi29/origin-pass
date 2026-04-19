import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/Button"

type Props = {
  /** Optional dismiss — omit for always-visible banner */
  className?: string
}

export function UpgradeNudge({ className }: Props) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/90 p-4 sm:flex-row sm:items-center sm:justify-between ${className ?? ""}`}
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          <Sparkles className="h-5 w-5 text-ds-secondary" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-ds-text">
            Unlock analytics &amp; unlimited passports
          </p>
          <p className="mt-0.5 text-xs text-ds-text-muted">
            Upgrade to see full insights, priority support, and higher limits.
          </p>
        </div>
      </div>
      <Button href="/pricing" variant="primary" size="sm" className="shrink-0">
        Upgrade
      </Button>
    </div>
  )
}
