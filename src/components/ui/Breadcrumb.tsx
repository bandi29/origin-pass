"use client"

import { Children, type ReactNode } from "react"
import { Link } from "@/i18n/navigation"
import { ChevronRight } from "lucide-react"
import clsx from "clsx"

export type BreadcrumbItemProps = {
  href?: string
  children: ReactNode
  active?: boolean
  className?: string
}

export function BreadcrumbItem({
  href,
  children,
  active,
  className,
}: BreadcrumbItemProps) {
  const isActive = active ?? !href
  const base =
    "text-sm text-slate-500 transition-colors hover:text-slate-800 hover:underline underline-offset-2 decoration-slate-300"

  if (isActive) {
    return (
      <span
        className={clsx(
          "text-sm font-medium text-slate-900",
          className
        )}
        aria-current="page"
      >
        {children}
      </span>
    )
  }

  return (
    <Link href={href!} className={clsx(base, className)}>
      {children}
    </Link>
  )
}

type BreadcrumbProps = {
  children: ReactNode
  className?: string
  separator?: ReactNode
}

export function Breadcrumb({
  children,
  className,
  separator = (
    <ChevronRight
      className="mx-1 h-3.5 w-3.5 shrink-0 text-slate-300"
      aria-hidden
    />
  ),
}: BreadcrumbProps) {
  const flat = Children.toArray(children).filter(Boolean)

  return (
    <nav
      aria-label="Breadcrumb"
      className={clsx(
        "flex flex-wrap items-center gap-y-1 text-left",
        className
      )}
    >
      <ol className="flex flex-wrap items-center gap-y-1">
        {flat.map((child, i) => (
          <li key={i} className="flex items-center">
            {i > 0 ? separator : null}
            {child}
          </li>
        ))}
      </ol>
    </nav>
  )
}
