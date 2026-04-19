import type { HTMLAttributes, ReactNode } from "react"
import clsx from "clsx"
import { surfaces } from "@/design-system/tokens"

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  padding?: boolean
  interactive?: boolean
}

export function Card({
  children,
  className,
  padding = true,
  interactive = false,
  ...rest
}: CardProps) {
  return (
    <div
      className={clsx(
        interactive ? surfaces.cardInteractive : surfaces.card,
        padding && "p-6",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
