import type { HTMLAttributes, ReactNode } from "react"
import clsx from "clsx"
import { surfaces } from "@/design-system/tokens"

type CardVariant = "default" | "soft" | "hero"

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  padding?: boolean
  interactive?: boolean
  /**
   * Visual variant:
   *   - default  → white surface, hairline border, resting shadow (the standard card).
   *   - soft     → canvas background, hairline border, no shadow. Use for nested
   *                tiles inside a card or low-emphasis grouping.
   *   - hero     → dark navy gradient hero block. Pairs with `<Button variant="onDark">`.
   */
  variant?: CardVariant
}

const variantClass: Record<CardVariant, string> = {
  default: surfaces.card,
  soft: surfaces.cardSoft,
  hero: surfaces.heroDark,
}

export function Card({
  children,
  className,
  padding = true,
  interactive = false,
  variant = "default",
  ...rest
}: CardProps) {
  // `interactive` only applies to the default surface; hero/soft variants do
  // not lift on hover (they're either dark or low-emphasis tiles).
  const base =
    interactive && variant === "default" ? surfaces.cardInteractive : variantClass[variant]

  return (
    <div className={clsx(base, padding && "p-6", className)} {...rest}>
      {children}
    </div>
  )
}
