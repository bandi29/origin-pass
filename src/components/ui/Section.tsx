import type { ReactNode } from "react"
import clsx from "clsx"
import { twMerge } from "tailwind-merge"

type Props = {
  children: ReactNode
  alt?: boolean
  className?: string
  stackClassName?: string
  id?: string
}

/**
 * Marketing band: vertical padding from `.marketing-band` in globals (plus optional `className`).
 */
export function Section({ children, alt, className, stackClassName, id }: Props) {
  return (
    <section
      id={id}
      className={twMerge(
        clsx("marketing-band", alt ? "bg-gray-50" : "bg-white"),
        className
      )}
    >
      <div className="marketing-container">
        <div
          className={twMerge(
            "flex min-w-0 w-full flex-col gap-12 md:gap-16",
            stackClassName
          )}
        >
          {children}
        </div>
      </div>
    </section>
  )
}
