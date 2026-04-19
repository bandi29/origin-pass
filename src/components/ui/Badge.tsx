import type { ReactNode } from "react"
import clsx from "clsx"

type Props = {
  children: ReactNode
  className?: string
}

export function Badge({ children, className }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-slate-700 transition-all duration-200",
        className
      )}
    >
      {children}
    </span>
  )
}
