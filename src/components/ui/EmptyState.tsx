import type { ReactNode } from "react"
import clsx from "clsx"
import { Button } from "@/components/ui/Button"

type EmptyStateProps = {
  title: string
  description?: string
  icon?: ReactNode
  action?: { label: string; href?: string; onClick?: () => void }
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-ds-border bg-ds-surface/80 py-16 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-medium text-ds-text">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-ds-text-muted">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-6">
          {action.href ? (
            <Button href={action.href} variant="primary">
              {action.label}
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
