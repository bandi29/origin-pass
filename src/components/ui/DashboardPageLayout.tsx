import type { ReactNode } from "react"
import clsx from "clsx"
import { spacing } from "@/design-system/tokens"

type Props = {
  children: ReactNode
  className?: string
}

/** Max-width dashboard column — used only inside {@link AppShell} */
export function DashboardPageLayout({ children, className }: Props) {
  return (
    <div
      className={clsx(
        "mx-auto w-full max-w-6xl",
        spacing.dashboardChromeStack,
        spacing.dashboardMain,
        className,
      )}
    >
      {children}
    </div>
  )
}
