import type { ReactNode } from "react"
import clsx from "clsx"
import { Button, type ButtonVariant } from "@/components/ui/Button"

export type PageHeaderActionItem = {
  label: string
  variant?: ButtonVariant
  href?: string
  external?: boolean
  onClick?: () => void
}

type PageHeaderProps = {
  title: string
  description?: ReactNode
  /** e.g. product or module context */
  contextBadge?: string
  /** Declarative actions (preferred for dashboard kit) */
  actionItems?: PageHeaderActionItem[]
  /** Legacy: custom action nodes */
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  contextBadge,
  actionItems,
  actions,
  className,
}: PageHeaderProps) {
  const renderedActions =
    actionItems && actionItems.length > 0 ? (
      <>
        {actionItems.map((a, i) =>
          a.href ? (
            <Button
              key={`${a.label}-${i}`}
              href={a.href}
              external={a.external}
              variant={a.variant ?? "outline"}
              size="md"
            >
              {a.label}
            </Button>
          ) : (
            <Button
              key={`${a.label}-${i}`}
              type="button"
              variant={a.variant ?? "primary"}
              size="md"
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          )
        )}
      </>
    ) : (
      actions
    )

  return (
    <div
      className={clsx(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ds-text">
            {title}
          </h1>
          {contextBadge ? (
            <span className="inline-flex max-w-full items-center rounded-full border border-ds-border bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-ds-text-muted">
              {contextBadge}
            </span>
          ) : null}
        </div>
        {description != null && description !== "" ? (
          <div className="text-sm text-ds-text-muted [&_code]:text-ds-text">
            {description}
          </div>
        ) : null}
      </div>
      {renderedActions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {renderedActions}
        </div>
      ) : null}
    </div>
  )
}
