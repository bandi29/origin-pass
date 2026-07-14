import type { ReactNode } from "react"
import clsx from "clsx"
import { Button } from "@/components/ui/Button"
import { tones } from "@/design-system/tokens"

type OnboardingAction = {
  label: string
  href: string
}

type OnboardingEmptyStateProps = {
  /** Informational glyph rendered inside the navy icon chip (pass a sized lucide icon). */
  icon: ReactNode
  heading: string
  body: string
  primaryAction: OnboardingAction
  secondaryAction?: OnboardingAction
  className?: string
}

/**
 * Self-guided onboarding rail for module zero-states. Unlike the generic
 * `EmptyState` (dashed "nothing here" placeholder), this is a deliberate
 * starting point: premium surface, clear next action, optional secondary path.
 */
export function OnboardingEmptyState({
  icon,
  heading,
  body,
  primaryAction,
  secondaryAction,
  className,
}: OnboardingEmptyStateProps) {
  return (
    <section
      className={clsx(
        "flex flex-col items-center rounded-2xl border border-slate-200/80",
        "bg-gradient-to-b from-slate-50/90 via-white to-white px-6 py-16 text-center shadow-sm",
        className,
      )}
    >
      <div
        className={clsx(
          "flex h-14 w-14 items-center justify-center rounded-2xl",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_1px_2px_rgba(15,23,42,0.06)]",
          tones.navy,
        )}
        aria-hidden
      >
        {icon}
      </div>

      <h2 className="mt-6 text-xl font-semibold tracking-tight text-ds-text md:text-2xl">
        {heading}
      </h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ds-text-muted">{body}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button href={primaryAction.href} variant="primary">
          {primaryAction.label}
        </Button>
        {secondaryAction ? (
          <Button href={secondaryAction.href} variant="secondary">
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
