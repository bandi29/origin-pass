import type { ReactNode } from "react"
import clsx from "clsx"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/Button"

type Props = {
  children: ReactNode
  locked: boolean
  title?: string
  className?: string
}

export function LockedFeature({
  children,
  locked,
  title = "Upgrade to unlock",
  className,
}: Props) {
  if (!locked) return <>{children}</>

  return (
    <div className={clsx("relative overflow-hidden rounded-2xl", className)}>
      <div className="pointer-events-none select-none blur-[2px] opacity-60">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/70 p-6 text-center backdrop-blur-[2px]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Lock className="h-6 w-6" aria-hidden />
        </div>
        <p className="text-sm font-medium text-ds-text">{title}</p>
        <Button href="/pricing" variant="primary" size="sm">
          View plans
        </Button>
      </div>
    </div>
  )
}
