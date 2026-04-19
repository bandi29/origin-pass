import type { ReactNode } from "react"
import clsx from "clsx"
import { twMerge } from "tailwind-merge"

type Props = {
  children: ReactNode
  className?: string
}

/** App / dashboard pages — same horizontal shell as marketing */
export function PageContainer({ children, className }: Props) {
  return (
    <div
      className={twMerge(
        clsx(
          "mx-auto max-w-[1200px] px-6 py-20 md:py-24",
          className
        )
      )}
    >
      {children}
    </div>
  )
}
