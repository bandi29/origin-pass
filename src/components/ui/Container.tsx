import type { ReactNode } from "react"
import { twMerge } from "tailwind-merge"

type Props = {
  children: ReactNode
  className?: string
}

/**
 * Centered page column — matches `.marketing-container` (1200px, 24px sides)
 */
export const containerClassName = "mx-auto w-full max-w-[1200px] px-[24px]"

export function Container({ children, className }: Props) {
  return <div className={twMerge(containerClassName, className)}>{children}</div>
}
