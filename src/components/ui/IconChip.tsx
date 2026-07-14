import type { ReactNode } from "react"
import { twMerge } from "tailwind-merge"
import { tones, type ToneName } from "@/design-system/tokens"

const sizes = {
  sm: "h-8 w-8 rounded-lg [&_svg]:h-4 [&_svg]:w-4",
  md: "h-10 w-10 rounded-xl [&_svg]:h-5 [&_svg]:w-5",
  lg: "h-12 w-12 rounded-2xl [&_svg]:h-6 [&_svg]:w-6",
} as const

export type IconChipSize = keyof typeof sizes
export type IconChipTone = ToneName

type Props = {
  children: ReactNode
  /** Soft tone palette — matches the design-system `tones` token. */
  tone?: IconChipTone
  size?: IconChipSize
  className?: string
}

/**
 * Soft-tinted icon container — the canonical "icon-well" used on stat cards,
 * empty states, list-item leading icons, and KPI tiles.
 *
 * Replaces the bespoke `flex h-10 w-10 ... rounded-xl bg-blue-50 text-blue-600`
 * blocks scattered across the dashboard, settings, analytics, and empty-state
 * surfaces. One radius scale, one set of brand-aligned tones, one place to tune.
 *
 * Use the matching `tone` from `src/design-system/tokens.ts` — adding a new tone
 * means editing one file and every chip in the app picks it up.
 */
export function IconChip({ children, tone = "slate", size = "md", className }: Props) {
  return (
    <span
      className={twMerge(
        "inline-flex shrink-0 items-center justify-center",
        sizes[size],
        tones[tone],
        className,
      )}
      aria-hidden
    >
      {children}
    </span>
  )
}
