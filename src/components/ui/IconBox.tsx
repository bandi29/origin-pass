import type { ReactNode } from "react"
import { twMerge } from "tailwind-merge"

const tones = {
  blue: "bg-blue-soft text-blue-600",
  purple: "bg-purple-soft text-purple-600",
  green: "bg-green-soft text-green-600",
  orange: "bg-orange-soft text-orange-600",
} as const

export type IconBoxTone = keyof typeof tones

type Props = {
  children: ReactNode
  tone: IconBoxTone
  className?: string
}

/** 40×40 rounded icon well — uses @theme soft surfaces */
export function IconBox({ children, tone, className }: Props) {
  return (
    <div
      className={twMerge(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        tones[tone],
        className
      )}
    >
      {children}
    </div>
  )
}
